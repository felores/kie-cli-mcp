import { timingSafeEqual } from "node:crypto";
import type { Server } from "node:http";
import express, {
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import {
  OpenAiHttpError,
  openAiErrorHandler,
} from "./errors.js";
import {
  createKieOpenAiRouter,
  type KieOpenAiRouter,
  type KieOpenAiRouterOptions,
} from "./http-server.js";
import { isLoopbackHostname } from "./validation.js";

export interface KieOpenAiStandaloneOptions extends KieOpenAiRouterOptions {
  token: string;
  host?: string;
  port?: number;
  allowedOrigins?: string[];
}

export type KieOpenAiStandaloneApp = express.Express & { close: () => void };

function parseHostHeader(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(`http://${value}`).hostname;
  } catch {
    return null;
  }
}

function secureTokenMatches(header: string | undefined, token: string): boolean {
  if (!header?.startsWith("Bearer ")) return false;
  const candidate = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(token);
  return (
    candidate.length === expected.length && timingSafeEqual(candidate, expected)
  );
}

function standaloneSecurity(options: {
  token: string;
  allowedOrigins: string[];
}): RequestHandler {
  const allowedOrigins = new Set(options.allowedOrigins);

  return (req: Request, res: Response, next: NextFunction) => {
    const requestHostname = parseHostHeader(req.headers.host);
    if (!requestHostname || !isLoopbackHostname(requestHostname)) {
      next(
        new OpenAiHttpError(
          421,
          "host_not_allowed",
          "The request Host header is not allowed.",
        ),
      );
      return;
    }

    const origin = req.headers.origin;
    if (origin) {
      let originAllowed = allowedOrigins.has(origin);
      if (!originAllowed) {
        try {
          originAllowed = isLoopbackHostname(new URL(origin).hostname);
        } catch {
          originAllowed = false;
        }
      }
      if (!originAllowed) {
        next(
          new OpenAiHttpError(
            403,
            "origin_not_allowed",
            "The request Origin is not allowed.",
          ),
        );
        return;
      }
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Authorization, Content-Type, X-Request-Id",
      );
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    }

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    if (!secureTokenMatches(req.headers.authorization, options.token)) {
      next(
        new OpenAiHttpError(
          401,
          "invalid_local_token",
          "A valid local bearer token is required.",
          null,
          "authentication_error",
        ),
      );
      return;
    }

    next();
  };
}

export function createKieOpenAiStandaloneApp(
  options: KieOpenAiStandaloneOptions,
): KieOpenAiStandaloneApp {
  const token = options.token.trim();
  if (!token) {
    throw new Error("KIE_OPENAI_TOKEN is required for standalone mode.");
  }

  const host = options.host ?? "127.0.0.1";
  if (!isLoopbackHostname(host)) {
    throw new Error(`Standalone host must be loopback; received "${host}".`);
  }

  const app = express() as KieOpenAiStandaloneApp;
  const router = createKieOpenAiRouter(options) as KieOpenAiRouter;
  app.disable("x-powered-by");
  app.use(
    standaloneSecurity({
      token,
      allowedOrigins: options.allowedOrigins ?? [],
    }),
  );
  app.use(router);
  app.use(openAiErrorHandler);
  app.close = () => router.close();
  return app;
}

export function startKieOpenAiStandaloneServer(
  options: KieOpenAiStandaloneOptions,
): Server {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 51311;
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid standalone port: ${port}.`);
  }

  const app = createKieOpenAiStandaloneApp(options);
  const server = app.listen(port, host, () => {
    console.error(
      `[Kie.ai OpenAI] listening on http://${host}:${port} (bearer auth required)`,
    );
  });
  server.once("close", app.close);
  return server;
}

export function runKieOpenAiStandaloneFromEnv(): Server {
  const allowedOrigins = (process.env.KIE_OPENAI_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return startKieOpenAiStandaloneServer({
    apiKey: process.env.KIE_AI_API_KEY,
    baseUrl: process.env.KIE_AI_BASE_URL,
    dataDir: process.env.KIE_OPENAI_DATA_DIR,
    token: process.env.KIE_OPENAI_TOKEN ?? "",
    host: process.env.KIE_OPENAI_HOST ?? "127.0.0.1",
    port: Number.parseInt(process.env.KIE_OPENAI_PORT ?? "51311", 10),
    allowedOrigins,
  });
}

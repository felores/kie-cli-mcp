import { randomUUID, timingSafeEqual } from "node:crypto";
import type { Server as HttpServer } from "node:http";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import type { Server } from "@modelcontextprotocol/server";
import { isInitializeRequest } from "@modelcontextprotocol/server";
import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import type { CallerPrincipal } from "./principal.js";
import type { TemporaryUploadStore } from "./upload-storage.js";

export interface HttpTransportOptions {
  /**
   * Builds one Server for a session, bound to the session's caller principal.
   * The transport owns session ids; callers derive all per-caller state
   * (approval owner, widget grants, plans, uploads) from the principal.
   */
  createServer: (principal: CallerPrincipal) => Server;
  version: string;
  uploadStore?: TemporaryUploadStore;
  host?: string;
  port?: number;
  token?: string;
  allowedHosts?: string[];
  allowedOrigins?: string[];
  uploadAllowedOrigins?: string[];
}

interface ResolvedHttpOptions extends HttpTransportOptions {
  host: string;
  port: number;
  token: string;
  allowedHosts: string[];
  allowedOrigins: string[];
  uploadAllowedOrigins: string[];
}

function envList(name: string): string[] {
  return (process.env[name] || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function resolveOptions(opts: HttpTransportOptions): ResolvedHttpOptions {
  return {
    ...opts,
    host: opts.host ?? process.env.MCP_HTTP_HOST ?? "127.0.0.1",
    port: opts.port ?? parseInt(process.env.MCP_HTTP_PORT || "3000", 10),
    token: opts.token ?? process.env.KIE_MCP_HTTP_TOKEN ?? "",
    allowedHosts: opts.allowedHosts ?? envList("MCP_ALLOWED_HOSTS"),
    allowedOrigins: opts.allowedOrigins ?? envList("MCP_ALLOWED_ORIGINS"),
    uploadAllowedOrigins:
      opts.uploadAllowedOrigins ?? envList("MCP_UPLOAD_ALLOWED_ORIGINS"),
  };
}

export function validateHttpTransportSecurity({
  host,
  token,
  allowedHosts,
  allowedOrigins = [],
  uploadAllowedOrigins = [],
  uploadEnabled = false,
}: {
  host: string;
  token: string;
  allowedHosts: string[];
  allowedOrigins?: string[];
  uploadAllowedOrigins?: string[];
  uploadEnabled?: boolean;
}): void {
  const isLoopbackHost =
    host === "127.0.0.1" || host === "localhost" || host === "::1";
  const missing = [
    ...(!isLoopbackHost && allowedHosts.length === 0
      ? ["MCP_ALLOWED_HOSTS"]
      : []),
    ...(!isLoopbackHost && !token ? ["KIE_MCP_HTTP_TOKEN"] : []),
    ...(uploadEnabled && allowedHosts.length === 0
      ? ["MCP_ALLOWED_HOSTS"]
      : []),
    ...(uploadEnabled && !token ? ["KIE_MCP_HTTP_TOKEN"] : []),
    ...(uploadEnabled && allowedOrigins.length === 0
      ? ["MCP_ALLOWED_ORIGINS"]
      : []),
    ...(uploadEnabled && uploadAllowedOrigins.length === 0
      ? ["MCP_UPLOAD_ALLOWED_ORIGINS"]
      : []),
  ];
  const unique = [...new Set(missing)];
  if (unique.length > 0) {
    throw new Error(
      `${unique.join(" and ")} ${unique.length === 1 ? "is" : "are"} required ${
        uploadEnabled
          ? "when temporary HTTP uploads are enabled"
          : `when MCP_HTTP_HOST is non-loopback (got "${host}")`
      }.`,
    );
  }
}

function normalizeHost(value: string): string {
  try {
    return new URL(`http://${value}`).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isAllowedHost(
  value: string | undefined,
  allowedHosts: string[],
): boolean {
  if (!value) return false;
  const normalized = normalizeHost(value);
  return allowedHosts.some(
    (allowed) =>
      allowed.toLowerCase() === value.toLowerCase() ||
      normalizeHost(allowed) === normalized,
  );
}

export function createHttpApp(options: HttpTransportOptions): Express {
  const opts = resolveOptions(options);
  validateHttpTransportSecurity({
    host: opts.host,
    token: opts.token,
    allowedHosts: opts.allowedHosts,
    allowedOrigins: opts.allowedOrigins,
    uploadAllowedOrigins: opts.uploadAllowedOrigins,
    uploadEnabled: Boolean(opts.uploadStore),
  });

  const app = express();
  const transports = new Map<string, NodeStreamableHTTPServerTransport>();

  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      transport: "streamable-http",
      sessions: transports.size,
      version: opts.version,
    });
  });

  // Host validation covers MCP and capability routes. Health stays exempt for
  // container probes. Public URLs are never derived from request headers.
  app.use((req: Request, res: Response, next) => {
    if (
      opts.allowedHosts.length > 0 &&
      !isAllowedHost(req.headers.host, opts.allowedHosts)
    ) {
      res.status(403).json({ error: "Invalid Host header" });
      return;
    }
    next();
  });

  if (opts.uploadStore) {
    const allowUploadOrigin = (req: Request, res: Response): boolean => {
      const origin = req.headers.origin;
      if (!origin) return true;
      if (!opts.uploadAllowedOrigins.includes(origin)) {
        res.status(403).json({ error: "Origin is not allowed" });
        return false;
      }
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      return true;
    };

    app.options("/upload/:token", (req: Request, res: Response) => {
      if (!allowUploadOrigin(req, res)) return;
      res.setHeader("Access-Control-Allow-Methods", "PUT, OPTIONS");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Content-Length",
      );
      res.setHeader("Access-Control-Max-Age", "600");
      res.status(204).end();
    });
    app.put("/upload/:token", async (req: Request, res: Response) => {
      if (!allowUploadOrigin(req, res)) return;
      await opts.uploadStore!.handleUpload(req, res, req.params.token);
    });
    app.get("/media/:token", async (req: Request, res: Response) => {
      await opts.uploadStore!.handleDownload(req, res, req.params.token);
    });
    app.head("/media/:token", async (req: Request, res: Response) => {
      await opts.uploadStore!.handleDownload(req, res, req.params.token);
    });
  }

  const requireAuth = (req: Request, res: Response): boolean => {
    if (!opts.token) return true;
    const header = req.headers.authorization || "";
    const expected = Buffer.from(`Bearer ${opts.token}`);
    const supplied = Buffer.from(header);
    if (
      supplied.length === expected.length &&
      timingSafeEqual(supplied, expected)
    ) {
      return true;
    }
    res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Unauthorized" },
      id: null,
    });
    return false;
  };

  const authorizeMcpRequest = (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    if (!requireAuth(req, res)) return;
    const origin = req.headers.origin;
    if (
      origin &&
      opts.allowedOrigins.length > 0 &&
      !opts.allowedOrigins.includes(origin)
    ) {
      res.status(403).json({
        jsonrpc: "2.0",
        error: { code: -32002, message: "Origin is not allowed" },
        id: null,
      });
      return;
    }
    next();
  };

  const mcpJsonParser = express.json({ limit: "10mb" });

  const securityOpts =
    opts.allowedHosts.length > 0
      ? {
          enableDnsRebindingProtection: true,
          allowedHosts: opts.allowedHosts,
          ...(opts.allowedOrigins.length > 0
            ? { allowedOrigins: opts.allowedOrigins }
            : {}),
        }
      : {};

  const onError = (res: Response, error: unknown) => {
    console.error("[Kie.ai MCP] HTTP handler error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  };

  app.post(
    "/mcp",
    authorizeMcpRequest,
    mcpJsonParser,
    async (req: Request, res: Response) => {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      let transport: NodeStreamableHTTPServerTransport | undefined = sessionId
        ? transports.get(sessionId)
        : undefined;

      try {
        if (!transport) {
          if (sessionId) {
            res.status(404).json({
              jsonrpc: "2.0",
              error: { code: -32001, message: "Session not found" },
              id: null,
            });
            return;
          }
          if (!isInitializeRequest(req.body)) {
            res.status(400).json({
              jsonrpc: "2.0",
              error: {
                code: -32000,
                message:
                  "Bad Request: missing session ID for a non-init request",
              },
              id: null,
            });
            return;
          }
          // The session id is decided before the transport and Server are
          // created so both are bound to the same caller principal: a fresh
          // Server for a resumed session resolves the same owner and state.
          const newSessionId = randomUUID();
          transport = new NodeStreamableHTTPServerTransport({
            sessionIdGenerator: () => newSessionId,
            onsessioninitialized: () => {
              transports.set(newSessionId, transport!);
            },
            ...securityOpts,
          });
          transport.onclose = () => {
            if (transport!.sessionId) transports.delete(transport!.sessionId);
          };
          await opts.createServer(newSessionId).connect(transport);
        }
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        onError(res, error);
      }
    },
  );

  const handleSessionRequest = async (req: Request, res: Response) => {
    if (!requireAuth(req, res)) return;
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId) {
      res.status(400).send("Missing Mcp-Session-Id header");
      return;
    }
    const transport = transports.get(sessionId);
    if (!transport) {
      res.status(404).send("Session not found");
      return;
    }
    try {
      await transport.handleRequest(req, res);
    } catch (error) {
      onError(res, error);
    }
  };

  app.get("/mcp", handleSessionRequest);
  app.delete("/mcp", handleSessionRequest);
  return app;
}

export function startHttpServer(options: HttpTransportOptions): HttpServer {
  const opts = resolveOptions(options);
  const app = createHttpApp(opts);
  const server = app.listen(opts.port, opts.host, () => {
    console.error(
      `[Kie.ai MCP] Streamable HTTP transport listening on http://${opts.host}:${opts.port}/mcp ` +
        `(health: /health, auth: ${opts.token ? "bearer token" : "none"}, ` +
        `dns-rebind protection: ${opts.allowedHosts.length > 0 ? "on" : "off"}, ` +
        `temporary uploads: ${opts.uploadStore ? "on" : "off"})`,
    );
  });
  if (opts.uploadStore) {
    server.on("close", () => void opts.uploadStore!.close());
  }
  return server;
}

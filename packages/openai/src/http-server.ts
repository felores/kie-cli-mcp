import express, {
  type NextFunction,
  type Request,
  type Response,
  type Router,
} from "express";
import { KieAiClient } from "@felores/kie-ai-core/client";
import {
  OpenAiHttpError,
  openAiErrorHandler,
} from "./errors.js";
import {
  DEFAULT_JSON_LIMIT_BYTES,
  DEFAULT_MULTIPART_LIMIT_BYTES,
  declaredBodyLimit,
  rejectClientControlFields,
} from "./validation.js";
import { CONTRACT_VERSION, PACKAGE_VERSION } from "./version.js";

export interface KieOpenAiRouterOptions {
  apiKey?: string;
  baseUrl?: string;
  dataDir?: string;
  packageVersion?: string;
  contractVersion?: string;
  jsonLimitBytes?: number;
  multipartLimitBytes?: number;
  requestTimeoutMs?: number;
}

export function createKieOpenAiRouter(
  options: KieOpenAiRouterOptions,
): Router {
  const apiKey = options.apiKey?.trim() ?? "";
  const packageVersion = options.packageVersion ?? PACKAGE_VERSION;
  const contractVersion = options.contractVersion ?? CONTRACT_VERSION;
  const client = apiKey
    ? new KieAiClient({
        apiKey,
        baseUrl: options.baseUrl ?? "https://api.kie.ai/api/v1",
        timeout: options.requestTimeoutMs ?? 60_000,
        callbackUrlFallback: "",
      })
    : null;
  const router = express.Router();

  router.use(
    declaredBodyLimit({
      jsonLimitBytes: options.jsonLimitBytes ?? DEFAULT_JSON_LIMIT_BYTES,
      multipartLimitBytes:
        options.multipartLimitBytes ?? DEFAULT_MULTIPART_LIMIT_BYTES,
    }),
  );
  router.use(
    express.json({
      limit: options.jsonLimitBytes ?? DEFAULT_JSON_LIMIT_BYTES,
    }),
  );
  router.use(rejectClientControlFields);

  router.get("/health", (_req: Request, res: Response) => {
    res.json({
      ready: client !== null,
      contract_version: contractVersion,
      package_version: packageVersion,
    });
  });

  router.use((_req: Request, _res: Response, next: NextFunction) => {
    next(
      new OpenAiHttpError(
        404,
        "route_not_found",
        "The requested KIE OpenAI transport route does not exist.",
        null,
        "invalid_request_error",
      ),
    );
  });
  router.use(openAiErrorHandler);

  return router;
}

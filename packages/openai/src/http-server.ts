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
  DEFAULT_RESULT_HOSTS,
  handleImageEdit,
  handleImageGeneration,
  type ImageAdapterContext,
} from "./image-adapters.js";
import { RequestJournal } from "./request-journal.js";
import {
  DEFAULT_JSON_LIMIT_BYTES,
  DEFAULT_MULTIPART_LIMIT_BYTES,
  declaredBodyLimit,
  rejectClientControlFields,
} from "./validation.js";
import { CONTRACT_VERSION, PACKAGE_VERSION } from "./version.js";
import {
  DEFAULT_VIDEO_RESULT_HOSTS,
  handleVideoCallback,
  handleVideoContent,
  handleVideoCreate,
  handleVideoStatus,
  type VideoAdapterContext,
} from "./video-adapters.js";
export interface KieOpenAiRouterOptions {
  apiKey?: string;
  baseUrl?: string;
  dataDir?: string;
  packageVersion?: string;
  contractVersion?: string;
  jsonLimitBytes?: number;
  multipartLimitBytes?: number;
  requestTimeoutMs?: number;
  uploadBaseUrl?: string;
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
  allowedResultHosts?: string[];
  videoMultipartLimitBytes?: number;
  callbackBaseUrl?: string;
}

export type KieOpenAiRouter = Router & { close: () => void };

function resultHosts(value: string[] | undefined): Set<string> {
  return new Set(
    (value ?? [...DEFAULT_RESULT_HOSTS])
      .map((host) => host.trim().toLowerCase().replace(/\.$/, ""))
      .filter((host) => host.length > 0 && !host.includes("/") && !host.includes("*")),
  );
}

export function createKieOpenAiRouter(
  options: KieOpenAiRouterOptions,
): KieOpenAiRouter {
  const apiKey = options.apiKey?.trim() ?? "";
  const packageVersion = options.packageVersion ?? PACKAGE_VERSION;
  const contractVersion = options.contractVersion ?? CONTRACT_VERSION;
  const client = apiKey
    ? new KieAiClient({
        apiKey,
        baseUrl: options.baseUrl ?? "https://api.kie.ai/api/v1",
        timeout: options.requestTimeoutMs ?? 60_000,
        callbackUrlFallback: "",
        fileUploadBaseUrl: options.uploadBaseUrl,
      })
    : null;
  let journal: RequestJournal | null = null;
  if (apiKey || options.dataDir || process.env.KIE_OPENAI_DATA_DIR) {
    try {
      journal = new RequestJournal(options.dataDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EACCES") throw error;
    }
  }
  const imageContext: ImageAdapterContext = {
    client: client as KieAiClient,
    journal: journal as RequestJournal,
    pollIntervalMs: options.pollIntervalMs ?? 1_000,
    pollTimeoutMs: options.pollTimeoutMs ?? 180_000,
    multipartLimitBytes:
      options.multipartLimitBytes ?? DEFAULT_MULTIPART_LIMIT_BYTES,
    allowedResultHosts: resultHosts(options.allowedResultHosts),
  };
  const videoContext: VideoAdapterContext = {
    client: client as KieAiClient,
    journal: journal as RequestJournal,
    pollIntervalMs: options.pollIntervalMs ?? 5_000,
    pollTimeoutMs: options.pollTimeoutMs ?? 600_000,
    multipartLimitBytes:
      options.videoMultipartLimitBytes ??
      options.multipartLimitBytes ??
      DEFAULT_MULTIPART_LIMIT_BYTES,
    allowedResultHosts: resultHosts(
      options.allowedResultHosts ?? [...DEFAULT_VIDEO_RESULT_HOSTS],
    ),
    callbackBaseUrl: options.callbackBaseUrl,
  };
  const router = express.Router() as KieOpenAiRouter;
  let closed = false;
  router.close = () => {
    if (closed) return;
    closed = true;
    journal?.close();
  };

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
      ready: client !== null && journal !== null,
      contract_version: contractVersion,
      package_version: packageVersion,
    });
  });

  if (journal || !client) {
    router.post(
      "/v1/images/generations",
      (req: Request, res: Response, next: NextFunction) => {
        void handleImageGeneration(req, res, imageContext).catch(next);
      },
    );
    router.post(
      "/v1/images/edits",
      (req: Request, res: Response, next: NextFunction) => {
        void handleImageEdit(req, res, imageContext).catch(next);
      },
    );
    router.post(
      "/v1/videos",
      (req: Request, res: Response, next: NextFunction) => {
        void handleVideoCreate(req, res, videoContext).catch(next);
      },
    );
    router.get(
      "/v1/videos/:id",
      (req: Request, res: Response, next: NextFunction) => {
        void handleVideoStatus(req, res, videoContext).catch(next);
      },
    );
    router.get(
      "/v1/videos/:id/content",
      (req: Request, res: Response, next: NextFunction) => {
        void handleVideoContent(req, res, videoContext).catch(next);
      },
    );
    router.post(
      "/v1/videos/:id/callback",
      (req: Request, res: Response, next: NextFunction) => {
        void handleVideoCallback(req, res, videoContext).catch(next);
      },
    );
  } else {
    const unavailable = (_req: Request, _res: Response, next: NextFunction) => {
      next(
        new OpenAiHttpError(
          502,
          "kie_upstream_error",
          "The KIE transport data directory is unavailable.",
          null,
          "api_error",
        ),
      );
    };
    router.post("/v1/images/generations", unavailable);
    router.post("/v1/images/edits", unavailable);
    router.post("/v1/videos", unavailable);
    router.get("/v1/videos/:id", unavailable);
    router.get("/v1/videos/:id/content", unavailable);
    router.post("/v1/videos/:id/callback", unavailable);
  }

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

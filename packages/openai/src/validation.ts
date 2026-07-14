import type { NextFunction, Request, RequestHandler, Response } from "express";
import { OpenAiHttpError } from "./errors.js";

export const DEFAULT_JSON_LIMIT_BYTES = 1024 * 1024;
export const DEFAULT_MULTIPART_LIMIT_BYTES = 25 * 1024 * 1024;

const SECRET_FIELDS: Record<string, true> = {
  apikey: true,
  kieapikey: true,
  kieaiapikey: true,
  providerapikey: true,
};
const REMOTE_OUTPUT_FIELDS: Record<string, true> = {
  callbackurl: true,
  outputurl: true,
  resulturl: true,
  webhookurl: true,
};

function normalizedFieldName(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function findForbiddenField(
  value: unknown,
  seen = new Set<object>(),
): { field: string; code: string; message: string } | null {
  if (typeof value !== "object" || value === null || seen.has(value)) return null;
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      const result = findForbiddenField(item, seen);
      if (result) return result;
    }
    return null;
  }

  for (const [field, child] of Object.entries(value)) {
    const normalized = normalizedFieldName(field);
    if (SECRET_FIELDS[normalized]) {
      return {
        field,
        code: "client_credentials_forbidden",
        message: "Provider credentials must be configured on the server.",
      };
    }
    if (REMOTE_OUTPUT_FIELDS[normalized]) {
      return {
        field,
        code: "remote_output_url_forbidden",
        message: "Remote callback and output URLs are not accepted.",
      };
    }
    const result = findForbiddenField(child, seen);
    if (result) return result;
  }

  return null;
}

export function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1"
  );
}

export function declaredBodyLimit(options: {
  jsonLimitBytes?: number;
  multipartLimitBytes?: number;
}): RequestHandler {
  const jsonLimitBytes = options.jsonLimitBytes ?? DEFAULT_JSON_LIMIT_BYTES;
  const multipartLimitBytes =
    options.multipartLimitBytes ?? DEFAULT_MULTIPART_LIMIT_BYTES;

  return (req: Request, _res: Response, next: NextFunction) => {
    const rawLength = req.headers["content-length"];
    const multipart = Boolean(req.is("multipart/form-data"));
    if (multipart && typeof rawLength !== "string") {
      next(
        new OpenAiHttpError(
          411,
          "content_length_required",
          "Multipart requests require a Content-Length header.",
        ),
      );
      return;
    }

    const contentLength =
      typeof rawLength === "string" ? Number.parseInt(rawLength, 10) : 0;
    const limit = multipart ? multipartLimitBytes : jsonLimitBytes;
    if (
      !Number.isFinite(contentLength) ||
      contentLength < 0 ||
      contentLength > limit
    ) {
      next(
        new OpenAiHttpError(
          413,
          "request_too_large",
          "The request body is too large.",
        ),
      );
      return;
    }
    next();
  };
}

export const rejectClientControlFields: RequestHandler = (
  req,
  _res,
  next,
) => {
  const forbidden = findForbiddenField(req.body);
  if (!forbidden) {
    next();
    return;
  }

  next(
    new OpenAiHttpError(
      422,
      forbidden.code,
      forbidden.message,
      forbidden.field,
    ),
  );
};

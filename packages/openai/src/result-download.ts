import { isIP } from "node:net";
import {
  KieAiClient,
  KieAiRequestError,
} from "@felores/kie-ai-core/client";
import { OpenAiHttpError } from "./errors.js";
import {
  KieAiResponseError,
  MAX_RESULT_FILE_BYTES,
} from "./uploads.js";

export const DEFAULT_VIDEO_RESULT_HOSTS = [
  "file.aiquickdraw.com",
  "tempfile.aiquickdraw.com",
] as const;

export class UnsafeResultUrlError extends Error {
  constructor() {
    super("The provider result URL is not safe to download.");
    this.name = "UnsafeResultUrlError";
  }
}

export class InvalidProviderResultError extends Error {
  constructor() {
    super("The provider returned an invalid result.");
    this.name = "InvalidProviderResultError";
  }
}

export function isPrivateHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized === "0.0.0.0"
  ) {
    return true;
  }
  const version = isIP(normalized);
  if (version === 4) {
    const octets = normalized.split(".").map(Number);
    return (
      octets[0] === 10 ||
      octets[0] === 127 ||
      octets[0] === 0 ||
      (octets[0] === 169 && octets[1] === 254) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168) ||
      octets[0] >= 224
    );
  }
  if (version === 6) {
    return (
      normalized === "::1" ||
      normalized === "::" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb")
    );
  }
  return false;
}

export function assertSafeResultUrl(
  value: string,
  previousUrl?: string,
  allowedHosts: ReadonlySet<string> = new Set(DEFAULT_VIDEO_RESULT_HOSTS),
): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new UnsafeResultUrlError();
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port === "80" ||
    (url.port !== "" && url.port !== "443") ||
    isPrivateHost(url.hostname) ||
    !allowedHosts.has(url.hostname.toLowerCase())
  ) {
    throw new UnsafeResultUrlError();
  }
  if (previousUrl) assertSafeResultUrl(previousUrl, undefined, allowedHosts);
}

const VIDEO_SIGNATURES: Array<{ type: string; bytes: number[] }> = [
  { type: "video/mp4", bytes: [0x00, 0x00, 0x00] },
];

export function validateVideoBytes(
  bytes: Uint8Array,
  contentType: string | null,
  label = "result",
): void {
  const normalizedType = contentType?.toLowerCase().split(";", 1)[0];
  if (normalizedType && !normalizedType.startsWith("video/")) {
    throw new InvalidProviderResultError();
  }
  const matched = VIDEO_SIGNATURES.some((sig) =>
    sig.bytes.every((value, index) => bytes[index] === value),
  );
  if (!matched && bytes.length < 4) {
    throw new InvalidProviderResultError();
  }
}

export function readResultUrls(data: Record<string, unknown>): string[] {
  let result: unknown = data.resultJson;
  if (typeof result === "string") {
    try {
      result = JSON.parse(result) as unknown;
    } catch {
      throw new Error("The provider returned malformed result data.");
    }
  }
  const isRecord = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v);
  const resultRecord = isRecord(result) ? result : undefined;
  const urls = resultRecord?.resultUrls ?? data.resultUrls;
  if (
    !Array.isArray(urls) ||
    !urls.every((url) => typeof url === "string") ||
    urls.length === 0
  ) {
    throw new Error("The provider returned no results.");
  }
  return urls as string[];
}

export async function downloadResultBytes(
  client: KieAiClient,
  url: string,
  allowedHosts: ReadonlySet<string>,
  maxBytes = MAX_RESULT_FILE_BYTES,
): Promise<{ bytes: Uint8Array; contentType: string | null }> {
  const downloaded = await client.downloadFile(url, {
    validateUrl: (currentUrl, previousUrl) =>
      assertSafeResultUrl(currentUrl, previousUrl, allowedHosts),
    maxBytes,
  });
  return { bytes: downloaded.bytes, contentType: downloaded.contentType };
}

export function providerError(
  message: string,
  status: number,
  code: string,
): OpenAiHttpError {
  return new OpenAiHttpError(status, code, message, null, "api_error");
}

export function classifyProviderError(error: unknown): {
  httpError: OpenAiHttpError;
  unknownAcceptance: boolean;
} {
  if (
    error instanceof UnsafeResultUrlError ||
    error instanceof InvalidProviderResultError
  ) {
    return {
      httpError: providerError(
        "KIE returned an invalid result.",
        502,
        "kie_invalid_result",
      ),
      unknownAcceptance: false,
    };
  }
  if (error instanceof KieAiResponseError) {
    return classifyProviderCode(error.providerCode);
  }
  if (error instanceof KieAiRequestError) {
    if (
      error.status === 408 ||
      error.status === 504 ||
      error.name === "AbortError"
    ) {
      return {
        httpError: providerError(
          "KIE did not finish before the local timeout.",
          504,
          "kie_timeout",
        ),
        unknownAcceptance: true,
      };
    }
    if (error.status === 401 || error.status === 403) {
      return {
        httpError: providerError(
          "KIE rejected the configured provider credentials.",
          502,
          "kie_upstream_auth",
        ),
        unknownAcceptance: false,
      };
    }
    if (error.status === 402) {
      return {
        httpError: providerError(
          "KIE credits are insufficient for this request.",
          402,
          "insufficient_credits",
        ),
        unknownAcceptance: false,
      };
    }
    if (error.status === 429) {
      return {
        httpError: providerError(
          "KIE rate or concurrency limit reached.",
          429,
          "kie_rate_limited",
        ),
        unknownAcceptance: false,
      };
    }
    if (error.status !== undefined && error.status >= 400 && error.status < 500) {
      return {
        httpError: providerError(
          "KIE rejected the request.",
          422,
          "kie_request_rejected",
        ),
        unknownAcceptance: false,
      };
    }
  }
  if (
    typeof error === "object" &&
    error !== null &&
    ((error as { name?: unknown }).name === "AbortError" ||
      (error as { name?: unknown }).name === "TimeoutError")
  ) {
    return {
      httpError: providerError(
        "KIE did not finish before the local timeout.",
        504,
        "kie_timeout",
      ),
      unknownAcceptance: true,
    };
  }
  return {
    httpError: providerError(
      "KIE returned an invalid or unavailable response.",
      502,
      "kie_upstream_error",
    ),
    unknownAcceptance: true,
  };
}

function classifyProviderCode(code: number): {
  httpError: OpenAiHttpError;
  unknownAcceptance: boolean;
} {
  if (code === 408 || code === 504) {
    return {
      httpError: providerError(
        "KIE did not finish before the local timeout.",
        504,
        "kie_timeout",
      ),
      unknownAcceptance: true,
    };
  }
  if (code === 401 || code === 403) {
    return {
      httpError: providerError(
        "KIE rejected the configured provider credentials.",
        502,
        "kie_upstream_auth",
      ),
      unknownAcceptance: false,
    };
  }
  if (code === 402) {
    return {
      httpError: providerError(
        "KIE credits are insufficient for this request.",
        402,
        "insufficient_credits",
      ),
      unknownAcceptance: false,
    };
  }
  if (code === 429) {
    return {
      httpError: providerError(
        "KIE rate or concurrency limit reached.",
        429,
        "kie_rate_limited",
      ),
      unknownAcceptance: false,
    };
  }
  if (code >= 400 && code < 500) {
    return {
      httpError: providerError(
        "KIE rejected the request.",
        422,
        "kie_request_rejected",
      ),
      unknownAcceptance: false,
    };
  }
  return {
    httpError: providerError(
      "KIE returned an invalid or unavailable response.",
      502,
      "kie_upstream_error",
    ),
    unknownAcceptance: true,
  };
}

export function responseCodeIsSuccessful(code: number): boolean {
  return code === 200 || code === 0;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function taskIdFromResponse(response: {
  code: number;
  data?: { taskId?: string };
}): string {
  if (!responseCodeIsSuccessful(response.code) || !response.data?.taskId) {
    throw new KieAiResponseError(
      response.code,
      "The provider did not return a task ID.",
    );
  }
  return response.data.taskId;
}

export function journalError(error: OpenAiHttpError): {
  status: number;
  code: string;
  message: string;
  param: string | null;
} {
  return {
    status: error.status,
    code: error.code,
    message: error.message,
    param: error.param,
  };
}

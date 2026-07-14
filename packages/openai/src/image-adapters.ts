import { createHash, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import type { Request, Response } from "express";
import {
  GptImage2Schema,
  NanoBananaImageSchema,
  type GptImage2Request,
  type NanoBananaImageRequest,
} from "@felores/kie-ai-core";
import {
  KieAiClient,
  KieAiRequestError,
} from "@felores/kie-ai-core/client";
import { OpenAiHttpError } from "./errors.js";
import {
  KieAiResponseError,
  MAX_REFERENCE_TOTAL_BYTES,
  MAX_RESULT_FILE_BYTES,
  MultipartImageFile,
  MultipartParseError,
  parseMultipartForm,
  uploadReferenceImages,
  validateImageBytes,
  validateImageFile,
} from "./uploads.js";
import {
  RequestJournal,
  RequestJournalConflictError,
  hashRequestId,
  type JournalError,
  type RequestJournalRecord,
} from "./request-journal.js";

export const KIE_IMAGE_MODELS = [
  "kie-nano-banana-image",
  "kie-gpt-image-2",
] as const;

export type KieImageModel = (typeof KIE_IMAGE_MODELS)[number];

export const DEFAULT_RESULT_HOSTS = [
  "file.aiquickdraw.com",
  "tempfile.aiquickdraw.com",
] as const;

const NANO_RATIOS = [
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "21:9",
] as const;
const GPT_RATIOS = ["1:1", "9:16", "16:9", "4:3", "3:4"] as const;
const QUALITY_TO_RESOLUTION: Record<string, "1K" | "2K" | "4K"> = {
  auto: "1K",
  low: "1K",
  standard: "1K",
  medium: "2K",
  hd: "2K",
  high: "4K",
};
const ALLOWED_FIELDS = new Set([
  "model",
  "prompt",
  "n",
  "quality",
  "size",
  "response_format",
]);

interface NormalizedImageRequest {
  model: KieImageModel;
  prompt: string;
  count: number;
  resolution: "1K" | "2K" | "4K";
  aspectRatio: string;
  responseFormat: "b64_json";
  references: MultipartImageFile[];
}

interface ImageAdapterContext {
  client: KieAiClient;
  journal: RequestJournal;
  pollIntervalMs: number;
  pollTimeoutMs: number;
  multipartLimitBytes: number;
  allowedResultHosts: ReadonlySet<string>;
}

class ProviderTaskFailedError extends Error {
  constructor() {
    super("The provider task failed.");
    this.name = "ProviderTaskFailedError";
  }
}

class ProviderTimeoutError extends Error {
  constructor() {
    super("The provider task timed out.");
    this.name = "ProviderTimeoutError";
  }
}

class UnsafeResultUrlError extends Error {
  constructor() {
    super("The provider result URL is not safe to download.");
    this.name = "UnsafeResultUrlError";
  }
}

class InvalidProviderResultError extends Error {
  constructor() {
    super("The provider returned an invalid image result.");
    this.name = "InvalidProviderResultError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAbortLike(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    ((value as { name?: unknown }).name === "AbortError" ||
      (value as { name?: unknown }).name === "TimeoutError")
  );
}

function invalidSetting(message: string, param: string | null = null): OpenAiHttpError {
  return new OpenAiHttpError(422, "unsupported_setting", message, param);
}

function invalidReference(
  message: string,
  param: string | null = "image",
): OpenAiHttpError {
  return new OpenAiHttpError(422, "unsupported_reference", message, param);
}

function unknownModel(value: unknown): never {
  throw new OpenAiHttpError(
    422,
    "unsupported_model",
    `The model must be one of: ${KIE_IMAGE_MODELS.join(", ")}.`,
    "model",
  );
}

function assertObjectBody(value: unknown): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    throw invalidSetting("The image request body must be a JSON object.");
  }
}

function assertAllowedFields(value: Record<string, unknown>): void {
  for (const field of Object.keys(value)) {
    if (!ALLOWED_FIELDS.has(field)) {
      throw invalidSetting(`The image setting '${field}' is not supported.`, field);
    }
  }
}

function readModel(value: unknown): KieImageModel {
  if (
    value === "kie-nano-banana-image" ||
    value === "kie-gpt-image-2"
  ) {
    return value;
  }
  unknownModel(value);
}

function readString(
  value: unknown,
  field: string,
  required = false,
): string | undefined {
  if (value === undefined && !required) return undefined;
  if (typeof value !== "string" || (required && value.trim().length === 0)) {
    throw invalidSetting(`The ${field} setting is invalid.`, field);
  }
  return value;
}

function readCount(value: unknown): number {
  if (value === undefined) return 1;
  const count =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;
  if (!Number.isInteger(count) || count < 1 || count > 15) {
    throw invalidSetting("The n setting must be an integer from 1 to 15.", "n");
  }
  return count;
}

function readQuality(value: unknown): "1K" | "2K" | "4K" {
  if (value === undefined) return "1K";
  if (typeof value !== "string" || !QUALITY_TO_RESOLUTION[value]) {
    throw invalidSetting(
      "The quality setting must be auto, low, standard, medium, hd, or high.",
      "quality",
    );
  }
  return QUALITY_TO_RESOLUTION[value];
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = left;
  let b = right;
  while (b !== 0) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a;
}

function reduceRatio(width: number, height: number): string {
  const divisor = greatestCommonDivisor(width, height);
  return `${width / divisor}:${height / divisor}`;
}

function readAspectRatio(value: unknown, model: KieImageModel): string {
  if (value === undefined || value === "auto" || value === "") return "auto";
  if (typeof value !== "string") {
    throw invalidSetting("The size setting is invalid.", "size");
  }

  let ratio: string;
  const dimensionMatch = value.match(/^(\d+)x(\d+)$/i);
  const ratioMatch = value.match(/^(\d+):(\d+)$/);
  if (dimensionMatch) {
    const width = Number(dimensionMatch[1]);
    const height = Number(dimensionMatch[2]);
    if (width < 1 || height < 1) {
      throw invalidSetting("The size setting must have positive dimensions.", "size");
    }
    ratio = reduceRatio(width, height);
  } else if (ratioMatch) {
    const width = Number(ratioMatch[1]);
    const height = Number(ratioMatch[2]);
    if (width < 1 || height < 1) {
      throw invalidSetting("The size setting must have positive dimensions.", "size");
    }
    ratio = reduceRatio(width, height);
  } else {
    throw invalidSetting(
      "The size setting must be auto or a supported WxH image size.",
      "size",
    );
  }

  const supported = model === "kie-nano-banana-image" ? NANO_RATIOS : GPT_RATIOS;
  if (!(supported as readonly string[]).includes(ratio)) {
    throw invalidSetting(
      `The size ratio ${ratio} is not supported for ${model}.`,
      "size",
    );
  }
  return ratio;
}

function readResponseFormat(value: unknown): "b64_json" {
  if (value !== undefined && value !== "b64_json") {
    throw invalidSetting(
      "Only response_format=b64_json is supported.",
      "response_format",
    );
  }
  return "b64_json";
}

function validateCoreRequest(
  input: NormalizedImageRequest,
  imageUrls: string[],
): void {
  const result =
    input.model === "kie-nano-banana-image"
      ? NanoBananaImageSchema.safeParse({
          prompt: input.prompt,
          ...(imageUrls.length ? { image_input: imageUrls } : {}),
          output_format: "png",
          aspect_ratio: input.aspectRatio,
          resolution: input.resolution,
          google_search: false,
        })
      : GptImage2Schema.safeParse({
          prompt: input.prompt,
          ...(imageUrls.length ? { input_urls: imageUrls } : {}),
          aspect_ratio: input.aspectRatio,
          resolution: input.resolution,
        });
  if (!result.success) {
    const issue = result.error.issues[0];
    throw invalidSetting(issue?.message ?? "The image request is invalid.", String(issue?.path[0] ?? "prompt"));
  }
}

function normalizeJsonRequest(body: unknown): NormalizedImageRequest {
  assertObjectBody(body);
  assertAllowedFields(body);
  const model = readModel(body.model);
  const prompt = readString(body.prompt, "prompt", true)!;
  const normalized: NormalizedImageRequest = {
    model,
    prompt,
    count: readCount(body.n),
    resolution: readQuality(body.quality),
    aspectRatio: readAspectRatio(body.size, model),
    responseFormat: readResponseFormat(body.response_format),
    references: [],
  };
  validateCoreRequest(normalized, []);
  return normalized;
}

function formValue(fields: Map<string, string[]>, field: string): string | undefined {
  const values = fields.get(field);
  return values?.length === 1 ? values[0] : values?.[0];
}

function assertMultipartFields(fields: Map<string, string[]>): void {
  for (const field of fields.keys()) {
    if (!ALLOWED_FIELDS.has(field) && field !== "mask" && field !== "mask[]") {
      throw invalidSetting(`The image setting '${field}' is not supported.`, field);
    }
  }
}

function validateReferences(
  model: KieImageModel,
  files: MultipartImageFile[],
): void {
  const references = files.filter(
    (file) => file.fieldName === "image" || file.fieldName === "image[]",
  );
  const unexpectedFile = files.find(
    (file) => file.fieldName !== "image" && file.fieldName !== "image[]",
  );
  const maskFile = files.find(
    (file) => file.fieldName === "mask" || file.fieldName === "mask[]",
  );
  if (maskFile) {
    throw invalidSetting("Mask editing is not supported by the KIE transport.", "mask");
  }
  if (unexpectedFile) {
    throw invalidReference("Only image and image[] reference fields are supported.", unexpectedFile.fieldName);
  }
  const max = model === "kie-nano-banana-image" ? 14 : 16;
  if (references.length === 0) {
    throw invalidReference("At least one image reference is required.");
  }
  if (references.length > max) {
    throw invalidReference(`This model accepts at most ${max} image references.`);
  }
  let totalBytes = 0;
  for (const file of references) {
    try {
      validateImageFile(file);
    } catch (error) {
      if (error instanceof MultipartParseError) {
        throw invalidReference(error.message, file.fieldName);
      }
      throw error;
    }
    totalBytes += file.bytes.length;
  }
  if (totalBytes > MAX_REFERENCE_TOTAL_BYTES) {
    throw invalidReference("The total reference image size is too large.");
  }
}

async function normalizeMultipartRequest(
  request: Request,
  maxBytes: number,
): Promise<NormalizedImageRequest> {
  const parsed = await parseMultipartForm(request, maxBytes);
  if (parsed.fields.has("mask") || parsed.fields.has("mask[]")) {
    throw invalidSetting("Mask editing is not supported by the KIE transport.", "mask");
  }
  assertMultipartFields(parsed.fields);
  const model = readModel(formValue(parsed.fields, "model"));
  const files = parsed.files.filter(
    (file) => file.fieldName === "image" || file.fieldName === "image[]",
  );
  validateReferences(model, parsed.files);
  const normalized: NormalizedImageRequest = {
    model,
    prompt: readString(formValue(parsed.fields, "prompt"), "prompt", true)!,
    count: readCount(formValue(parsed.fields, "n")),
    resolution: readQuality(formValue(parsed.fields, "quality")),
    aspectRatio: readAspectRatio(formValue(parsed.fields, "size"), model),
    responseFormat: readResponseFormat(formValue(parsed.fields, "response_format")),
    references: files,
  };
  validateCoreRequest(normalized, files.map(() => "https://placeholder.invalid/image"));
  return normalized;
}

function requestId(request: Request): string {
  const value = request.get("Idempotency-Key") || request.get("X-Request-Id");
  return value?.trim() || randomUUID();
}

function requestFingerprint(input: NormalizedImageRequest): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        model: input.model,
        prompt: input.prompt,
        count: input.count,
        resolution: input.resolution,
        aspectRatio: input.aspectRatio,
        responseFormat: input.responseFormat,
        references: input.references.map((file) => ({
          fieldName: file.fieldName,
          filename: file.filename,
          contentType: file.contentType,
          size: file.bytes.length,
          bytes: createHash("sha256").update(file.bytes).digest("hex"),
        })),
      }),
    )
    .digest("hex");
}

function ambiguousSubmission(
  message = "Provider acceptance could not be resolved safely. Do not retry this request automatically.",
): OpenAiHttpError {
  return new OpenAiHttpError(
    409,
    "ambiguous_submission",
    message,
    "Idempotency-Key",
  );
}

function idempotencyConflict(): OpenAiHttpError {
  return ambiguousSubmission(
    "The Idempotency-Key was already used for a different request.",
  );
}

function safeResultUrl(
  value: string,
  previousUrl?: string,
  allowedHosts: ReadonlySet<string> = new Set(DEFAULT_RESULT_HOSTS),
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
  if (previousUrl) safeResultUrl(previousUrl, undefined, allowedHosts);
}

function isPrivateHost(hostname: string): boolean {
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

function providerError(message: string, status: number, code: string): OpenAiHttpError {
  return new OpenAiHttpError(status, code, message, null, "api_error");
}

function classifyProviderError(error: unknown): {
  httpError: OpenAiHttpError;
  unknownAcceptance: boolean;
} {
  if (error instanceof UnsafeResultUrlError || error instanceof InvalidProviderResultError) {
    return {
      httpError: providerError(
        "KIE returned an invalid image result.",
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
    if (error.status === 408 || error.status === 504 || error.name === "AbortError") {
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
  if (isAbortLike(error)) {
    return {
      httpError: providerError(
        "KIE did not finish before the local timeout.",
        504,
        "kie_timeout",
      ),
      unknownAcceptance: true,
    };
  }
  if (error instanceof ProviderTimeoutError) {
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
      httpError: providerError("KIE rejected the request.", 422, "kie_request_rejected"),
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

function journalError(error: OpenAiHttpError): JournalError {
  return {
    status: error.status,
    code: error.code,
    message: error.message,
    param: error.param,
  };
}

function responseFor(record: RequestJournalRecord): { created: number; data: Array<{ b64_json: string }> } {
  if (!record.outputs) throw new Error("The request journal has no image outputs.");
  return {
    created: record.created,
    data: record.outputs.map((b64_json) => ({ b64_json })),
  };
}

function responseCodeIsSuccessful(code: number): boolean {
  return code === 200 || code === 0;
}

function taskIdFromResponse(response: { code: number; data?: { taskId?: string } }): string {
  if (!responseCodeIsSuccessful(response.code) || !response.data?.taskId) {
    throw new KieAiResponseError(
      response.code,
      "The provider did not return a task ID.",
    );
  }
  return response.data.taskId;
}

function providerTaskType(model: KieImageModel): "nano-banana-image" | "gpt-image-2" {
  return model === "kie-nano-banana-image" ? "nano-banana-image" : "gpt-image-2";
}

async function runBounded<T>(
  count: number,
  limit: number,
  worker: (index: number) => Promise<T>,
): Promise<T[]> {
  const results = Array.from({ length: count }) as T[];
  let nextIndex = 0;
  const run = async (): Promise<void> => {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= count) return;
      results[index] = await worker(index);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(count, limit) }, () => run()),
  );
  return results;
}

function providerRequest(
  input: NormalizedImageRequest,
  imageUrls: string[],
): NanoBananaImageRequest | GptImage2Request {
  if (input.model === "kie-nano-banana-image") {
    return NanoBananaImageSchema.parse({
      prompt: input.prompt,
      ...(imageUrls.length ? { image_input: imageUrls } : {}),
      output_format: "png",
      aspect_ratio: input.aspectRatio,
      resolution: input.resolution,
      google_search: false,
    });
  }
  return GptImage2Schema.parse({
    prompt: input.prompt,
    ...(imageUrls.length ? { input_urls: imageUrls } : {}),
    aspect_ratio: input.aspectRatio,
    resolution: input.resolution,
  });
}

async function submitTask(
  client: KieAiClient,
  input: NormalizedImageRequest,
  imageUrls: string[],
): Promise<string> {
  const request = providerRequest(input, imageUrls);
  const response =
    input.model === "kie-nano-banana-image"
      ? await client.generateNanoBananaImage(request as NanoBananaImageRequest)
      : await client.generateGptImage2(request as GptImage2Request);
  return taskIdFromResponse(response);
}

function readResultUrls(data: Record<string, unknown>): string[] {
  let result: unknown = data.resultJson;
  if (typeof result === "string") {
    try {
      result = JSON.parse(result) as unknown;
    } catch {
      throw new Error("The provider returned malformed result data.");
    }
  }
  const resultRecord = isRecord(result) ? result : undefined;
  const urls = resultRecord?.resultUrls ?? data.resultUrls;
  if (!Array.isArray(urls) || !urls.every((url) => typeof url === "string") || urls.length === 0) {
    throw new Error("The provider returned no image results.");
  }
  return urls as string[];
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise<void>((resolvePromise) => {
    setTimeout(resolvePromise, milliseconds);
  });
}

async function pollAndDownload(
  client: KieAiClient,
  model: KieImageModel,
  taskId: string,
  context: ImageAdapterContext,
): Promise<string[]> {
  const deadline = Date.now() + context.pollTimeoutMs;
  let firstPoll = true;
  for (;;) {
    if (!firstPoll && Date.now() >= deadline) {
      throw new ProviderTimeoutError();
    }
    firstPoll = false;
    const response = await client.getTaskStatus(taskId, providerTaskType(model));
    if (!responseCodeIsSuccessful(response.code) || !isRecord(response.data)) {
      throw new KieAiResponseError(response.code, "The provider status response is invalid.");
    }
    const state = response.data.state;
    if (state === "fail") throw new ProviderTaskFailedError();
    if (state === "success") {
      const urls = readResultUrls(response.data);
      const downloads: string[] = [];
      for (const url of urls) {
        const downloaded = await client.downloadFile(url, {
          validateUrl: (currentUrl, previousUrl) =>
            safeResultUrl(currentUrl, previousUrl, context.allowedResultHosts),
          maxBytes: MAX_RESULT_FILE_BYTES,
        });
        try {
          validateImageBytes(downloaded.bytes, downloaded.contentType);
        } catch (error) {
          if (error instanceof MultipartParseError) {
            throw new InvalidProviderResultError();
          }
          throw error;
        }
        downloads.push(Buffer.from(downloaded.bytes).toString("base64"));
      }
      return downloads;
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new ProviderTimeoutError();
    }
    await delay(Math.min(context.pollIntervalMs, remaining));
  }
}

async function markFailed(
  journal: RequestJournal,
  requestIdHash: string,
  error: OpenAiHttpError,
): Promise<void> {
  await journal.updateCurrent(requestIdHash, {
    state: "failed",
    error: journalError(error),
  });
}

async function submitTasks(
  input: NormalizedImageRequest,
  imageUrls: string[],
  context: ImageAdapterContext,
  requestIdHash: string,
): Promise<RequestJournalRecord> {
  const taskIds: Array<string | null> = Array.from(
    { length: input.count },
    () => null,
  );
  const failures: Array<{ error: unknown; index: number }> = [];
  let providerAccepted = 0;
  let stopScheduling = false;
  await runBounded(input.count, 2, async (index) => {
    if (stopScheduling) return;
    try {
      const taskId = await submitTask(context.client, input, imageUrls);
      providerAccepted += 1;
      taskIds[index] = taskId;
      await context.journal.updateCurrent(requestIdHash, (record) => ({
        state: "submitted",
        taskIds: record.taskIds.map(
          (existing, taskIndex) => existing ?? taskIds[taskIndex],
        ),
      }));
    } catch (error) {
      stopScheduling = true;
      failures.push({ error, index });
    }
  });

  const current = await context.journal.read(requestIdHash);
  if (!current) throw new Error("The request journal record disappeared.");
  if (failures.length > 0) {
    const classifiedFailures = failures.map(({ error, index }) => ({
      index,
      ...classifyProviderError(error),
    }));
    classifiedFailures.sort((left, right) => left.index - right.index);
    if (
      providerAccepted > 0 ||
      classifiedFailures.some((failure) => failure.unknownAcceptance)
    ) {
      throw ambiguousSubmission();
    }
    const failure = classifiedFailures[0];
    if (!failure) throw ambiguousSubmission();
    await markFailed(context.journal, requestIdHash, failure.httpError);
    throw failure.httpError;
  }
  if (current.state !== "submitted" || current.taskIds.some((taskId) => taskId === null)) {
    throw ambiguousSubmission();
  }
  return current;
}

async function resumeSubmitted(
  record: RequestJournalRecord,
  input: NormalizedImageRequest,
  context: ImageAdapterContext,
  requestIdHash: string,
): Promise<{ created: number; data: Array<{ b64_json: string }> }> {
  if (
    record.taskIds.length !== input.count ||
    record.taskIds.some((taskId) => taskId === null)
  ) {
    throw ambiguousSubmission();
  }
  try {
    const outputs = await runBounded(record.taskIds.length, 2, (index) =>
      pollAndDownload(context.client, input.model, record.taskIds[index]!, context),
    );
    const completed = await context.journal.updateCurrent(requestIdHash, {
      state: "succeeded",
      outputs: outputs.flat(),
    });
    return responseFor(completed);
  } catch (error) {
    if (error instanceof ProviderTaskFailedError) {
      const failure = providerError(
        "KIE reported that the image task failed.",
        502,
        "kie_upstream_error",
      );
      await markFailed(context.journal, requestIdHash, failure);
      throw failure;
    }
    const classified = classifyProviderError(error);
    if (!classified.unknownAcceptance) {
      await markFailed(context.journal, requestIdHash, classified.httpError);
    }
    throw classified.httpError;
  }
}

function assertMatchingRequest(
  record: RequestJournalRecord,
  input: NormalizedImageRequest,
  fingerprint: string,
): void {
  if (
    record.model !== input.model ||
    record.count !== input.count ||
    record.fingerprint !== fingerprint
  ) {
    throw idempotencyConflict();
  }
}

async function resumeExistingRecord(
  record: RequestJournalRecord,
  input: NormalizedImageRequest,
  context: ImageAdapterContext,
  requestIdHash: string,
): Promise<{ created: number; data: Array<{ b64_json: string }> }> {
  if (record.state === "succeeded") return responseFor(record);
  if (record.state === "failed") {
    const failure = record.error;
    if (failure) {
      throw new OpenAiHttpError(
        failure.status,
        failure.code,
        failure.message,
        failure.param,
      );
    }
    throw providerError("The previous KIE request failed.", 502, "kie_upstream_error");
  }
  if (record.state === "reserved") throw ambiguousSubmission();
  return resumeSubmitted(record, input, context, requestIdHash);
}

async function executeImageRequest(
  request: Request,
  input: NormalizedImageRequest,
  context: ImageAdapterContext,
): Promise<{ created: number; data: Array<{ b64_json: string }> }> {
  const id = requestId(request);
  const requestIdHash = hashRequestId(id);
  const fingerprint = requestFingerprint(input);
  const existing = await context.journal.read(requestIdHash);
  if (existing) {
    assertMatchingRequest(existing, input, fingerprint);
    return resumeExistingRecord(existing, input, context, requestIdHash);
  }

  let imageUrls: string[] = [];
  try {
    if (input.references.length > 0) {
      imageUrls = await uploadReferenceImages(context.client, input.references);
    }
    validateCoreRequest(input, imageUrls);
  } catch (error) {
    if (error instanceof OpenAiHttpError) throw error;
    if (error instanceof MultipartParseError) {
      throw invalidReference(error.message);
    }
    const classified = classifyProviderError(error);
    throw classified.httpError;
  }

  let reservation: Awaited<ReturnType<RequestJournal["reserve"]>>;
  try {
    reservation = await context.journal.reserve({
      requestId: id,
      model: input.model,
      count: input.count,
      fingerprint,
    });
  } catch (error) {
    if (error instanceof RequestJournalConflictError) {
      throw idempotencyConflict();
    }
    throw error;
  }
  if (!reservation.created) {
    assertMatchingRequest(reservation.record, input, fingerprint);
    return resumeExistingRecord(
      reservation.record,
      input,
      context,
      requestIdHash,
    );
  }

  try {
    await submitTasks(input, imageUrls, context, requestIdHash);
    const submitted = await context.journal.read(requestIdHash);
    if (!submitted) throw new Error("The request journal record disappeared.");
    return resumeSubmitted(submitted, input, context, requestIdHash);
  } catch (error) {
    if (error instanceof OpenAiHttpError) throw error;
    if (error instanceof MultipartParseError) {
      const failure = invalidReference(error.message);
      await markFailed(context.journal, requestIdHash, failure);
      throw failure;
    }
    const classified = classifyProviderError(error);
    if (classified.unknownAcceptance) throw ambiguousSubmission();
    await markFailed(context.journal, requestIdHash, classified.httpError);
    throw classified.httpError;
  }
}

export async function handleImageGeneration(
  request: Request,
  response: Response,
  context: ImageAdapterContext,
): Promise<void> {
  if (!context.client) {
    throw new OpenAiHttpError(
      503,
      "kie_unconfigured",
      "KIE is not configured on the server.",
      null,
      "server_error",
    );
  }
  const input = normalizeJsonRequest(request.body);
  const result = await executeImageRequest(request, input, context);
  response.status(200).json(result);
}

export async function handleImageEdit(
  request: Request,
  response: Response,
  context: ImageAdapterContext,
): Promise<void> {
  if (!context.client) {
    throw new OpenAiHttpError(
      503,
      "kie_unconfigured",
      "KIE is not configured on the server.",
      null,
      "server_error",
    );
  }
  let input: NormalizedImageRequest;
  try {
    input = await normalizeMultipartRequest(request, context.multipartLimitBytes);
  } catch (error) {
    if (error instanceof MultipartParseError) {
      throw invalidReference(error.message);
    }
    throw error;
  }
  const result = await executeImageRequest(request, input, context);
  response.status(200).json(result);
}

export type { ImageAdapterContext, NormalizedImageRequest };
export { isPrivateHost, safeResultUrl };

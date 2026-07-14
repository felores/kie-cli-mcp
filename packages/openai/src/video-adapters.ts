import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import type { ByteDanceSeedanceVideoRequest } from "@felores/kie-ai-core";
import {
  KieAiClient,
  KieAiRequestError,
} from "@felores/kie-ai-core/client";
import { OpenAiHttpError } from "./errors.js";
import {
  KieAiResponseError,
  MultipartImageFile,
  MultipartParseError,
  MAX_VIDEO_REFERENCE_FILE_BYTES,
  MAX_AUDIO_REFERENCE_FILE_BYTES,
  parseMultipartForm,
  uploadReferenceFiles,
  uploadReferenceImages,
  validateAudioFile,
  validateImageFile,
  validateVideoFile,
} from "./uploads.js";
import {
  RequestJournal,
  RequestJournalConflictError,
  hashRequestId,
  type JournalError,
  type RequestJournalRecord,
} from "./request-journal.js";
import {
  DEFAULT_VIDEO_RESULT_HOSTS,
  InvalidProviderResultError,
  UnsafeResultUrlError,
  assertSafeResultUrl,
  classifyProviderError,
  downloadResultBytes,
  isRecord,
  journalError,
  providerError,
  readResultUrls,
  responseCodeIsSuccessful,
  taskIdFromResponse,
  validateVideoBytes,
} from "./result-download.js";

export const KIE_VIDEO_MODELS = [
  "kie-bytedance-video",
  "kie-bytedance-fast-video",
] as const;

export type KieVideoModel = (typeof KIE_VIDEO_MODELS)[number];

const SIZE_TO_RATIO: Record<string, string> = {
  "1280x720": "16:9",
  "720x1280": "9:16",
};

const ALLOWED_JSON_FIELDS = new Set([
  "model",
  "prompt",
  "seconds",
  "size",
  "resolution_name",
  "preset",
  "generate_audio",
  "web_search",
]);

const ALLOWED_MULTIPART_FIELDS = new Set([
  "model",
  "prompt",
  "seconds",
  "size",
  "resolution_name",
  "preset",
  "generate_audio",
  "web_search",
]);

const ALLOWED_MULTIPART_FILE_FIELDS = new Set([
  "input_reference",
  "input_reference[]",
  "reference_video",
  "reference_video[]",
  "reference_audio",
  "reference_audio[]",
  "first_frame",
  "last_frame",
]);

const VIDEO_PROVIDER_TYPE = "bytedance-seedance-video";

export interface VideoAdapterContext {
  client: KieAiClient;
  journal: RequestJournal;
  pollIntervalMs: number;
  pollTimeoutMs: number;
  multipartLimitBytes: number;
  allowedResultHosts: ReadonlySet<string>;
  callbackBaseUrl?: string;
}

interface NormalizedVideoRequest {
  model: KieVideoModel;
  prompt: string;
  duration: number;
  aspectRatio: string;
  resolution: string;
  generateAudio: boolean;
  webSearch: boolean;
  imageRefs: MultipartImageFile[];
  videoRefs: MultipartImageFile[];
  audioRefs: MultipartImageFile[];
  firstFrame?: MultipartImageFile;
  lastFrame?: MultipartImageFile;
}

function invalidSetting(
  message: string,
  param: string | null = null,
): OpenAiHttpError {
  return new OpenAiHttpError(422, "unsupported_setting", message, param);
}

function invalidReference(
  message: string,
  param = "input_reference",
): OpenAiHttpError {
  return new OpenAiHttpError(422, "unsupported_reference", message, param);
}

function unknownModel(value: unknown): never {
  throw new OpenAiHttpError(
    422,
    "unsupported_model",
    `The model must be one of: ${KIE_VIDEO_MODELS.join(", ")}.`,
    "model",
  );
}

function readModel(value: unknown): KieVideoModel {
  if (value === "kie-bytedance-video" || value === "kie-bytedance-fast-video") {
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

function readPrompt(value: unknown): string {
  const prompt = readString(value, "prompt", true)!;
  if (prompt.length < 3 || prompt.length > 20000) {
    throw invalidSetting(
      "The prompt must be 3 to 20,000 characters.",
      "prompt",
    );
  }
  return prompt;
}

function readDuration(value: unknown): number {
  if (value === undefined) return 5;
  const duration =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;
  if (!Number.isInteger(duration) || duration < 4 || duration > 15) {
    throw invalidSetting(
      "The seconds setting must be an integer from 4 to 15.",
      "seconds",
    );
  }
  return duration;
}

function readAspectRatio(value: unknown): string {
  if (value === undefined || value === "auto" || value === "") return "16:9";
  if (typeof value !== "string") {
    throw invalidSetting("The size setting is invalid.", "size");
  }
  const ratio = SIZE_TO_RATIO[value.toLowerCase()];
  if (!ratio) {
    throw invalidSetting(
      `The size '${value}' is not supported. Use 1280x720 or 720x1280.`,
      "size",
    );
  }
  return ratio;
}

function readResolution(value: unknown): string {
  if (value === undefined) return "720p";
  if (value !== "480p" && value !== "720p") {
    throw invalidSetting(
      "The resolution_name must be 480p or 720p.",
      "resolution_name",
    );
  }
  return value;
}

function readPreset(value: unknown): void {
  if (value !== undefined && value !== "normal") {
    throw invalidSetting(
      "The preset must be 'normal' or omitted.",
      "preset",
    );
  }
}

function readBoolean(
  value: unknown,
  field: string,
  defaultValue: boolean,
): boolean {
  if (value === undefined) return defaultValue;
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  throw invalidSetting(`The ${field} setting must be a boolean.`, field);
}

function assertAllowedJsonFields(body: Record<string, unknown>): void {
  for (const field of Object.keys(body)) {
    if (!ALLOWED_JSON_FIELDS.has(field)) {
      throw invalidSetting(
        `The video setting '${field}' is not supported.`,
        field,
      );
    }
  }
}

function normalizeJsonVideoRequest(body: unknown): NormalizedVideoRequest {
  if (!isRecord(body)) {
    throw invalidSetting("The video request body must be a JSON object.");
  }
  assertAllowedJsonFields(body);
  const model = readModel(body.model);
  return {
    model,
    prompt: readPrompt(body.prompt),
    duration: readDuration(body.seconds),
    aspectRatio: readAspectRatio(body.size),
    resolution: readResolution(body.resolution_name),
    generateAudio: readBoolean(body.generate_audio, "generate_audio", true),
    webSearch: readBoolean(body.web_search, "web_search", false),
    imageRefs: [],
    videoRefs: [],
    audioRefs: [],
  };
}

function formValue(
  fields: Map<string, string[]>,
  field: string,
): string | undefined {
  return fields.get(field)?.[0];
}

function assertMultipartFields(fields: Map<string, string[]>): void {
  for (const field of fields.keys()) {
    if (!ALLOWED_MULTIPART_FIELDS.has(field)) {
      throw invalidSetting(
        `The video setting '${field}' is not supported.`,
        field,
      );
    }
  }
}

function partitionMultipartFiles(files: MultipartImageFile[]): {
  images: MultipartImageFile[];
  videos: MultipartImageFile[];
  audios: MultipartImageFile[];
  firstFrame?: MultipartImageFile;
  lastFrame?: MultipartImageFile;
} {
  const images: MultipartImageFile[] = [];
  const videos: MultipartImageFile[] = [];
  const audios: MultipartImageFile[] = [];
  let firstFrame: MultipartImageFile | undefined;
  let lastFrame: MultipartImageFile | undefined;

  for (const file of files) {
    if (!ALLOWED_MULTIPART_FILE_FIELDS.has(file.fieldName)) {
      throw invalidReference(
        `The file field '${file.fieldName}' is not supported.`,
        file.fieldName,
      );
    }
    if (file.fieldName === "input_reference" || file.fieldName === "input_reference[]") {
      images.push(file);
    } else if (file.fieldName === "reference_video" || file.fieldName === "reference_video[]") {
      videos.push(file);
    } else if (file.fieldName === "reference_audio" || file.fieldName === "reference_audio[]") {
      audios.push(file);
    } else if (file.fieldName === "first_frame") {
      if (firstFrame) throw invalidReference("Only one first_frame is allowed.", "first_frame");
      firstFrame = file;
    } else if (file.fieldName === "last_frame") {
      if (lastFrame) throw invalidReference("Only one last_frame is allowed.", "last_frame");
      lastFrame = file;
    }
  }

  if (images.length > 9) {
    throw invalidReference("At most 9 image references are supported.", "input_reference");
  }
  if (videos.length > 3) {
    throw invalidReference("At most 3 video references are supported.", "reference_video");
  }
  if (audios.length > 3) {
    throw invalidReference("At most 3 audio references are supported.", "reference_audio");
  }

  return { images, videos, audios, firstFrame, lastFrame };
}

async function normalizeMultipartVideoRequest(
  request: Request,
  maxBytes: number,
): Promise<NormalizedVideoRequest> {
  const parsed = await parseMultipartForm(request, maxBytes);
  assertMultipartFields(parsed.fields);
  const model = readModel(formValue(parsed.fields, "model"));
  const partitioned = partitionMultipartFiles(parsed.files);
  for (const file of partitioned.images) validateImageFile(file);
  for (const file of partitioned.videos) validateVideoFile(file);
  for (const file of partitioned.audios) validateAudioFile(file);
  if (partitioned.firstFrame) validateImageFile(partitioned.firstFrame);
  if (partitioned.lastFrame) validateImageFile(partitioned.lastFrame);

  return {
    model,
    prompt: readPrompt(formValue(parsed.fields, "prompt")),
    duration: readDuration(formValue(parsed.fields, "seconds")),
    aspectRatio: readAspectRatio(formValue(parsed.fields, "size")),
    resolution: readResolution(formValue(parsed.fields, "resolution_name")),
    generateAudio: readBoolean(
      formValue(parsed.fields, "generate_audio"),
      "generate_audio",
      true,
    ),
    webSearch: readBoolean(
      formValue(parsed.fields, "web_search"),
      "web_search",
      false,
    ),
    imageRefs: partitioned.images,
    videoRefs: partitioned.videos,
    audioRefs: partitioned.audios,
    firstFrame: partitioned.firstFrame,
    lastFrame: partitioned.lastFrame,
  };
}

function videoRequestFingerprint(input: NormalizedVideoRequest): string {
  const fileHash = (file: MultipartImageFile): unknown => ({
    fieldName: file.fieldName,
    filename: file.filename,
    contentType: file.contentType,
    size: file.bytes.length,
    bytes: createHash("sha256").update(file.bytes).digest("hex"),
  });
  return createHash("sha256")
    .update(
      JSON.stringify({
        model: input.model,
        prompt: input.prompt,
        duration: input.duration,
        aspectRatio: input.aspectRatio,
        resolution: input.resolution,
        generateAudio: input.generateAudio,
        webSearch: input.webSearch,
        images: input.imageRefs.map(fileHash),
        videos: input.videoRefs.map(fileHash),
        audios: input.audioRefs.map(fileHash),
        firstFrame: input.firstFrame ? fileHash(input.firstFrame) : null,
        lastFrame: input.lastFrame ? fileHash(input.lastFrame) : null,
      }),
    )
    .digest("hex");
}

function buildSeedanceRequest(
  input: NormalizedVideoRequest,
  uploaded: {
    imageUrls: string[];
    videoUrls: string[];
    audioUrls: string[];
    firstFrameUrl?: string;
    lastFrameUrl?: string;
  },
  callbackUrl?: string,
): ByteDanceSeedanceVideoRequest {
  const payload: Record<string, unknown> = {
    mode: input.model === "kie-bytedance-fast-video" ? "fast" : "standard",
    prompt: input.prompt,
    aspect_ratio: input.aspectRatio,
    resolution: input.resolution,
    duration: input.duration,
    generate_audio: input.generateAudio,
    web_search: input.webSearch,
    nsfw_checker: false,
  };
  if (uploaded.imageUrls.length > 0) {
    payload.reference_image_urls = uploaded.imageUrls;
  }
  if (uploaded.videoUrls.length > 0) {
    payload.reference_video_urls = uploaded.videoUrls;
  }
  if (uploaded.audioUrls.length > 0) {
    payload.reference_audio_urls = uploaded.audioUrls;
  }
  if (uploaded.firstFrameUrl) {
    payload.first_frame_url = uploaded.firstFrameUrl;
  }
  if (uploaded.lastFrameUrl) {
    payload.last_frame_url = uploaded.lastFrameUrl;
  }
  if (callbackUrl) {
    payload.callBackUrl = callbackUrl;
  }
  return payload as ByteDanceSeedanceVideoRequest;
}

async function uploadAllReferences(
  client: KieAiClient,
  input: NormalizedVideoRequest,
): Promise<{
  imageUrls: string[];
  videoUrls: string[];
  audioUrls: string[];
  firstFrameUrl?: string;
  lastFrameUrl?: string;
}> {
  const imageUrls =
    input.imageRefs.length > 0
      ? await uploadReferenceImages(client, input.imageRefs)
      : [];
  const videoUrls =
    input.videoRefs.length > 0
      ? await uploadReferenceFiles(
          client,
          input.videoRefs,
          validateVideoFile,
          MAX_VIDEO_REFERENCE_FILE_BYTES,
        )
      : [];
  const audioUrls =
    input.audioRefs.length > 0
      ? await uploadReferenceFiles(
          client,
          input.audioRefs,
          validateAudioFile,
          MAX_AUDIO_REFERENCE_FILE_BYTES,
        )
      : [];
  const firstFrameUrl = input.firstFrame
    ? (await uploadReferenceImages(client, [input.firstFrame]))[0]
    : undefined;
  const lastFrameUrl = input.lastFrame
    ? (await uploadReferenceImages(client, [input.lastFrame]))[0]
    : undefined;
  return { imageUrls, videoUrls, audioUrls, firstFrameUrl, lastFrameUrl };
}

function generateCallbackToken(): string {
  return randomUUID() + randomUUID();
}

function callbackUrlFor(
  context: VideoAdapterContext,
  requestIdHash: string,
  callbackToken: string,
): string | undefined {
  if (!context.callbackBaseUrl) return undefined;
  const base = context.callbackBaseUrl.replace(/\/+$/, "");
  return `${base}/v1/videos/${requestIdHash}/callback?token=${callbackToken}`;
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

function assertMatchingRequest(
  record: RequestJournalRecord,
  input: NormalizedVideoRequest,
  fingerprint: string,
): void {
  if (
    record.model !== input.model ||
    record.fingerprint !== fingerprint
  ) {
    throw idempotencyConflict();
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function pollVideoStatus(
  client: KieAiClient,
  taskId: string,
  context: VideoAdapterContext,
): Promise<{ resultUrl: string; contentType: string | null }> {
  const deadline = Date.now() + context.pollTimeoutMs;
  let firstPoll = true;
  for (;;) {
    if (!firstPoll && Date.now() >= deadline) {
      throw new Error("Provider task timed out.");
    }
    firstPoll = false;
    const response = await client.getTaskStatus(taskId, VIDEO_PROVIDER_TYPE);
    if (!responseCodeIsSuccessful(response.code) || !isRecord(response.data)) {
      throw new KieAiResponseError(
        response.code,
        "The provider status response is invalid.",
      );
    }
    const state = response.data.state;
    if (state === "fail") {
      throw new Error("The provider task failed.");
    }
    if (state === "success") {
      const urls = readResultUrls(response.data);
      if (urls.length !== 1) {
        throw new Error(
          "The provider returned multiple video results where one was expected.",
        );
      }
      assertSafeResultUrl(urls[0], undefined, context.allowedResultHosts);
      const contentType = extractVideoContentType(response.data, urls[0]);
      return { resultUrl: urls[0], contentType };
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("Provider task timed out.");
    await delay(Math.min(context.pollIntervalMs, remaining));
  }
}

function extractVideoContentType(
  data: Record<string, unknown>,
  url: string,
): string | null {
  const ext = url.split("?")[0]?.split(".").pop()?.toLowerCase();
  if (ext === "mp4") return "video/mp4";
  if (ext === "webm") return "video/webm";
  if (ext === "mov") return "video/quicktime";
  return ext ? `video/${ext}` : null;
}

function normalizeVideoStatus(
  record: RequestJournalRecord,
): { id: string; status: string; model: string; created: number } {
  const id = record.requestIdHash;
  let status: string;
  if (record.state === "succeeded") status = "completed";
  else if (record.state === "failed") status = "failed";
  else status = "pending";
  return { id, status, model: record.model, created: record.created };
}

export async function handleVideoCreate(
  request: Request,
  response: Response,
  context: VideoAdapterContext,
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

  const contentType = request.headers["content-type"];
  let input: NormalizedVideoRequest;
  if (typeof contentType === "string" && contentType.startsWith("multipart/form-data")) {
    try {
      input = await normalizeMultipartVideoRequest(
        request,
        context.multipartLimitBytes,
      );
    } catch (error) {
      if (error instanceof MultipartParseError) {
        throw invalidReference(error.message);
      }
      throw error;
    }
  } else {
    input = normalizeJsonVideoRequest(request.body);
  }

  const id =
    request.get("Idempotency-Key")?.trim() ||
    request.get("X-Request-Id")?.trim() ||
    randomUUID();
  const requestIdHash = hashRequestId(id);
  const fingerprint = videoRequestFingerprint(input);

  const existing = await context.journal.read(requestIdHash);
  if (existing) {
    assertMatchingRequest(existing, input, fingerprint);
    const status = normalizeVideoStatus(existing);
    response.status(200).json(status);
    return;
  }

  let uploaded: {
    imageUrls: string[];
    videoUrls: string[];
    audioUrls: string[];
    firstFrameUrl?: string;
    lastFrameUrl?: string;
  };
  try {
    uploaded = await uploadAllReferences(context.client, input);
  } catch (error) {
    if (error instanceof OpenAiHttpError) throw error;
    if (error instanceof MultipartParseError) {
      throw invalidReference(error.message);
    }
    const classified = classifyProviderError(error);
    throw classified.httpError;
  }

  const callbackToken = generateCallbackToken();
  const callbackUrl = callbackUrlFor(context, requestIdHash, callbackToken);

  let reservation: Awaited<ReturnType<RequestJournal["reserve"]>>;
  try {
    reservation = await context.journal.reserve({
      requestId: id,
      model: input.model,
      count: 1,
      fingerprint,
      callbackToken,
    });
  } catch (error) {
    if (error instanceof RequestJournalConflictError) {
      throw idempotencyConflict();
    }
    throw error;
  }
  if (!reservation.created) {
    assertMatchingRequest(reservation.record, input, fingerprint);
    const status = normalizeVideoStatus(reservation.record);
    response.status(200).json(status);
    return;
  }

  try {
    const seedanceRequest = buildSeedanceRequest(
      input,
      uploaded,
      callbackUrl,
    );
    const providerResponse =
      await context.client.generateByteDanceSeedanceVideo(seedanceRequest);
    const taskId = taskIdFromResponse(providerResponse);
    await context.journal.updateCurrent(requestIdHash, {
      state: "submitted",
      taskIds: [taskId],
    });
    const submitted = await context.journal.read(requestIdHash);
    if (!submitted) throw new Error("The request journal record disappeared.");
    response.status(200).json(normalizeVideoStatus(submitted));
  } catch (error) {
    if (error instanceof OpenAiHttpError) throw error;
    if (error instanceof MultipartParseError) {
      const failure = invalidReference(error.message);
      await context.journal.updateCurrent(requestIdHash, {
        state: "failed",
        error: journalError(failure),
      });
      throw failure;
    }
    const classified = classifyProviderError(error);
    if (classified.unknownAcceptance) {
      throw ambiguousSubmission();
    }
    await context.journal.updateCurrent(requestIdHash, {
      state: "failed",
      error: journalError(classified.httpError),
    });
    throw classified.httpError;
  }
}

export async function handleVideoStatus(
  request: Request,
  response: Response,
  context: VideoAdapterContext,
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
  const requestIdHash = request.params.id;
  const record = await context.journal.read(requestIdHash);
  if (!record) {
    throw new OpenAiHttpError(
      404,
      "task_not_found",
      "The video task was not found.",
      "id",
    );
  }

  if (record.state === "submitted" && record.taskIds[0]) {
    try {
      const result = await pollVideoStatus(
        context.client,
        record.taskIds[0],
        context,
      );
      await context.journal.updateCurrent(requestIdHash, {
        state: "succeeded",
        resultUrl: result.resultUrl,
        resultContentType: result.contentType ?? undefined,
      });
    } catch (error) {
      if (error instanceof UnsafeResultUrlError) {
        const failure = providerError(
          "KIE returned an invalid result URL.",
          502,
          "kie_invalid_result",
        );
        await context.journal.updateCurrent(requestIdHash, {
          state: "failed",
          error: journalError(failure),
        });
      } else if (error instanceof InvalidProviderResultError) {
        const failure = providerError(
          "KIE returned an invalid video result.",
          502,
          "kie_invalid_result",
        );
        await context.journal.updateCurrent(requestIdHash, {
          state: "failed",
          error: journalError(failure),
        });
      } else if (
        error instanceof Error &&
        (error.message === "The provider task failed." ||
          error.message === "The provider returned multiple video results where one was expected.")
      ) {
        const failure = providerError(
          "KIE reported that the video task failed.",
          502,
          "kie_upstream_error",
        );
        await context.journal.updateCurrent(requestIdHash, {
          state: "failed",
          error: journalError(failure),
        });
      } else if (
        error instanceof Error &&
        error.message === "Provider task timed out."
      ) {
        // leave submitted; client should retry
      } else {
        const classified = classifyProviderError(error);
        if (!classified.unknownAcceptance) {
          await context.journal.updateCurrent(requestIdHash, {
            state: "failed",
            error: journalError(classified.httpError),
          });
        }
      }
    }
  }

  const updated = await context.journal.read(requestIdHash);
  if (!updated) {
    throw new OpenAiHttpError(
      404,
      "task_not_found",
      "The video task was not found.",
      "id",
    );
  }
  response.status(200).json(normalizeVideoStatus(updated));
}

export async function handleVideoContent(
  request: Request,
  response: Response,
  context: VideoAdapterContext,
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
  const requestIdHash = request.params.id;
  const record = await context.journal.read(requestIdHash);
  if (!record) {
    throw new OpenAiHttpError(
      404,
      "task_not_found",
      "The video task was not found.",
      "id",
    );
  }
  if (record.state !== "succeeded") {
    throw new OpenAiHttpError(
      409,
      "task_not_ready",
      "The video content is not ready.",
      "id",
    );
  }
  if (!record.resultUrl) {
    throw new OpenAiHttpError(
      502,
      "kie_invalid_result",
      "No result URL is available for this task.",
      null,
    );
  }

  try {
    const downloaded = await downloadResultBytes(
      context.client,
      record.resultUrl,
      context.allowedResultHosts,
    );
    validateVideoBytes(downloaded.bytes, downloaded.contentType);
    const contentType =
      record.resultContentType ?? downloaded.contentType ?? "video/mp4";
    response.setHeader("Content-Type", contentType);
    response.setHeader("Content-Length", String(downloaded.bytes.length));
    response.status(200).send(Buffer.from(downloaded.bytes));
  } catch (error) {
    if (error instanceof UnsafeResultUrlError) {
      throw providerError(
        "KIE returned an invalid result URL.",
        502,
        "kie_invalid_result",
      );
    }
    if (error instanceof InvalidProviderResultError) {
      throw providerError(
        "KIE returned an invalid video result.",
        502,
        "kie_invalid_result",
      );
    }
    if (error instanceof KieAiRequestError) {
      const classified = classifyProviderError(error);
      throw classified.httpError;
    }
    throw error;
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

export async function handleVideoCallback(
  request: Request,
  response: Response,
  context: VideoAdapterContext,
): Promise<void> {
  if (!context.client) {
    response.status(200).json({ ok: true });
    return;
  }
  const requestIdHash = request.params.id;
  const token = (request.query.token as string) || request.get("X-Callback-Token");
  const record = await context.journal.read(requestIdHash);
  if (!record || !record.callbackToken) {
    response.status(404).json({ error: { message: "Not found", type: "not_found" } });
    return;
  }
  if (!token || !secureTokenMatches(`Bearer ${token}`, record.callbackToken)) {
    response
      .status(401)
      .json({ error: { message: "Invalid callback token", type: "authentication_error" } });
    return;
  }

  // Idempotent: if already terminal, no-op
  if (record.state === "succeeded" || record.state === "failed") {
    response.status(200).json({ ok: true, state: record.state });
    return;
  }

  // Only reconcile submitted tasks; never create a second task
  if (record.state !== "submitted" || !record.taskIds[0]) {
    response.status(200).json({ ok: true, state: record.state });
    return;
  }

  try {
    const result = await pollVideoStatus(
      context.client,
      record.taskIds[0],
      context,
    );
    await context.journal.updateCurrent(requestIdHash, {
      state: "succeeded",
      resultUrl: result.resultUrl,
      resultContentType: result.contentType ?? undefined,
    });
  } catch (error) {
    if (error instanceof UnsafeResultUrlError) {
      const failure = providerError(
        "KIE returned an invalid result URL.",
        502,
        "kie_invalid_result",
      );
      await context.journal.updateCurrent(requestIdHash, {
        state: "failed",
        error: journalError(failure),
      });
    } else if (error instanceof InvalidProviderResultError) {
      const failure = providerError(
        "KIE returned an invalid video result.",
        502,
        "kie_invalid_result",
      );
      await context.journal.updateCurrent(requestIdHash, {
        state: "failed",
        error: journalError(failure),
      });
    } else if (
      error instanceof Error &&
      error.message === "The provider task failed."
    ) {
      const failure = providerError(
        "KIE reported that the video task failed.",
        502,
        "kie_upstream_error",
      );
      await context.journal.updateCurrent(requestIdHash, {
        state: "failed",
        error: journalError(failure),
      });
    } else {
      // timeout or transient error: leave submitted; next poll or callback will retry
    }
  }
  response.status(200).json({ ok: true });
}

export { DEFAULT_VIDEO_RESULT_HOSTS };

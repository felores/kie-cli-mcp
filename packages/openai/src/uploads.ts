import type { IncomingMessage } from "node:http";
import { KieAiClient } from "@felores/kie-ai-core/client";

export const SUPPORTED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const SUPPORTED_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;
export const SUPPORTED_AUDIO_MIME_TYPES = [
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/aac",
  "audio/mp4",
] as const;
export const MAX_REFERENCE_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_VIDEO_REFERENCE_FILE_BYTES = 100 * 1024 * 1024;
export const MAX_AUDIO_REFERENCE_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_REFERENCE_TOTAL_BYTES = 25 * 1024 * 1024;
export const MAX_RESULT_FILE_BYTES = 25 * 1024 * 1024;

export interface MultipartImageFile {
  fieldName: string;
  filename: string;
  contentType: string;
  bytes: Uint8Array;
}

export interface ParsedMultipartForm {
  fields: Map<string, string[]>;
  files: MultipartImageFile[];
}

export class MultipartParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MultipartParseError";
  }
}

export class KieAiResponseError extends Error {
  constructor(
    readonly providerCode: number,
    message: string,
  ) {
    super(message);
    this.name = "KieAiResponseError";
  }
}

function isFile(value: FormDataEntryValue): value is File {
  return typeof value !== "string" && typeof value.arrayBuffer === "function";
}

export async function parseMultipartForm(
  request: IncomingMessage,
  maxBytes: number,
): Promise<ParsedMultipartForm> {
  const contentType = request.headers["content-type"];
  if (typeof contentType !== "string" || !contentType.startsWith("multipart/form-data")) {
    throw new MultipartParseError("Image edits require a multipart/form-data request.");
  }

  const chunks: Buffer[] = [];
  let total = 0;
  try {
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buffer.length;
      if (total > maxBytes) {
        throw new MultipartParseError("The multipart request is too large.");
      }
      chunks.push(buffer);
    }
  } catch (error) {
    if (error instanceof MultipartParseError) throw error;
    throw new MultipartParseError("The multipart request could not be parsed.");
  }

  try {
    const form = await new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": contentType },
      body: Buffer.concat(chunks),
    }).formData();
    const fields = new Map<string, string[]>();
    const files: MultipartImageFile[] = [];
    for (const [fieldName, value] of form.entries()) {
      if (isFile(value)) {
        files.push({
          fieldName,
          filename: value.name || "reference-image",
          contentType: value.type,
          bytes: new Uint8Array(await value.arrayBuffer()),
        });
      } else {
        const values = fields.get(fieldName) ?? [];
        values.push(value);
        fields.set(fieldName, values);
      }
    }
    return { fields, files };
  } catch {
    throw new MultipartParseError("The multipart request could not be parsed.");
  }
}

export function validateImageFile(file: MultipartImageFile): void {
  const contentType = file.contentType.toLowerCase().split(";", 1)[0];
  if (!SUPPORTED_IMAGE_MIME_TYPES.includes(contentType as (typeof SUPPORTED_IMAGE_MIME_TYPES)[number])) {
    throw new MultipartParseError(
      `Unsupported image MIME type for ${file.fieldName}.`,
    );
  }
  if (file.bytes.length === 0 || file.bytes.length > MAX_REFERENCE_FILE_BYTES) {
    throw new MultipartParseError(
      `Image ${file.filename} exceeds the supported size limit.`,
    );
  }
  validateImageBytes(file.bytes, contentType, file.filename);
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

export function validateImageBytes(
  bytes: Uint8Array,
  contentType: string | null,
  label = "result",
): void {
  const normalizedType = contentType?.toLowerCase().split(";", 1)[0];
  const valid =
    (normalizedType === "image/png" &&
      startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
    (normalizedType === "image/jpeg" && startsWith(bytes, [0xff, 0xd8, 0xff])) ||
    (normalizedType === "image/webp" &&
      startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
      startsWith(bytes.subarray(8), [0x57, 0x45, 0x42, 0x50]));
  if (!valid) {
    throw new MultipartParseError(`The ${label} is not a valid image.`);
  }
}

export async function uploadReferenceImages(
  client: KieAiClient,
  files: MultipartImageFile[],
): Promise<string[]> {
  let totalBytes = 0;
  const urls: string[] = [];
  for (const file of files) {
    validateImageFile(file);
    totalBytes += file.bytes.length;
    if (totalBytes > MAX_REFERENCE_TOTAL_BYTES) {
      throw new MultipartParseError("The total reference image size is too large.");
    }
    const response = await client.uploadFile({
      bytes: file.bytes,
      filename: file.filename,
      contentType: file.contentType,
    });
    if (response.code !== 200 && response.code !== 0) {
      throw new KieAiResponseError(
        response.code,
        "The provider rejected a reference image upload.",
      );
    }
    const url = response.data?.fileUrl;
    if (typeof url !== "string" || !url) {
      throw new Error("The provider did not return an uploaded image URL.");
    }
    urls.push(url);
  }
  return urls;
}

export function validateVideoFile(file: MultipartImageFile): void {
  const contentType = file.contentType.toLowerCase().split(";", 1)[0];
  if (!SUPPORTED_VIDEO_MIME_TYPES.includes(contentType as (typeof SUPPORTED_VIDEO_MIME_TYPES)[number])) {
    throw new MultipartParseError(
      `Unsupported video MIME type for ${file.fieldName}.`,
    );
  }
  if (file.bytes.length === 0 || file.bytes.length > MAX_VIDEO_REFERENCE_FILE_BYTES) {
    throw new MultipartParseError(
      `Video ${file.filename} exceeds the supported size limit.`,
    );
  }
}

export function validateAudioFile(file: MultipartImageFile): void {
  const contentType = file.contentType.toLowerCase().split(";", 1)[0];
  if (!SUPPORTED_AUDIO_MIME_TYPES.includes(contentType as (typeof SUPPORTED_AUDIO_MIME_TYPES)[number])) {
    throw new MultipartParseError(
      `Unsupported audio MIME type for ${file.fieldName}.`,
    );
  }
  if (file.bytes.length === 0 || file.bytes.length > MAX_AUDIO_REFERENCE_FILE_BYTES) {
    throw new MultipartParseError(
      `Audio ${file.filename} exceeds the supported size limit.`,
    );
  }
}

export async function uploadReferenceFiles(
  client: KieAiClient,
  files: MultipartImageFile[],
  validator: (file: MultipartImageFile) => void,
  maxFileBytes: number,
): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    validator(file);
    if (file.bytes.length > maxFileBytes) {
      throw new MultipartParseError(
        `Reference ${file.filename} exceeds the supported size limit.`,
      );
    }
    const response = await client.uploadFile({
      bytes: file.bytes,
      filename: file.filename,
      contentType: file.contentType,
    });
    if (response.code !== 200 && response.code !== 0) {
      throw new KieAiResponseError(
        response.code,
        "The provider rejected a reference upload.",
      );
    }
    const url = response.data?.fileUrl;
    if (typeof url !== "string" || !url) {
      throw new Error("The provider did not return an uploaded file URL.");
    }
    urls.push(url);
  }
  return urls;
}

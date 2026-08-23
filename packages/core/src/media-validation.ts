import { isIP } from "node:net";

export const SUPPORTED_UPLOAD_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/aac",
  "audio/mp4",
] as const;

export type SupportedUploadMimeType =
  (typeof SUPPORTED_UPLOAD_MIME_TYPES)[number];

function startsWith(
  bytes: Uint8Array,
  signature: number[],
  offset = 0,
): boolean {
  return signature.every((value, index) => bytes[offset + index] === value);
}

export function detectUploadMimeType(
  bytes: Uint8Array,
): SupportedUploadMimeType | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return "image/webp";
  }
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return "video/webm";
  if (startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4)) return "video/mp4";
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x41, 0x56, 0x45], 8)
  ) {
    return "audio/wav";
  }
  if (startsWith(bytes, [0x4f, 0x67, 0x67, 0x53])) return "audio/ogg";
  if (startsWith(bytes, [0x49, 0x44, 0x33])) return "audio/mpeg";
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
    return "audio/mpeg";
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0) {
    return "audio/aac";
  }
  return null;
}

export function normalizeUploadMimeType(
  value: string,
): SupportedUploadMimeType | null {
  const normalized = value.toLowerCase().split(";", 1)[0].trim();
  if (normalized === "audio/x-wav") return "audio/wav";
  return SUPPORTED_UPLOAD_MIME_TYPES.includes(
    normalized as SupportedUploadMimeType,
  )
    ? (normalized as SupportedUploadMimeType)
    : null;
}

export function validateUploadBytes(
  bytes: Uint8Array,
  declaredType?: string,
): SupportedUploadMimeType {
  if (bytes.length === 0) throw new Error("The upload is empty.");
  const detected = detectUploadMimeType(bytes);
  if (!detected) throw new Error("Unsupported or invalid media file.");
  if (declaredType) {
    const normalized = normalizeUploadMimeType(declaredType);
    const compatibleMp4 =
      detected === "video/mp4" &&
      (normalized === "video/mp4" ||
        normalized === "video/quicktime" ||
        normalized === "audio/mp4");
    if (!normalized || (normalized !== detected && !compatibleMp4)) {
      throw new Error(
        "The declared content_type does not match the file bytes.",
      );
    }
    return normalized;
  }
  return detected;
}

export function uploadPathForMimeType(type: SupportedUploadMimeType): string {
  if (type.startsWith("video/")) return "videos/user-uploads";
  if (type.startsWith("audio/")) return "audios/user-uploads";
  return "images/user-uploads";
}

export function validatePublicHttpUrl(value: string, label = "URL"): URL {
  const url = new URL(value);
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.username ||
    url.password ||
    (url.port && url.port !== "80" && url.port !== "443") ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    isIP(hostname) !== 0
  ) {
    throw new Error(
      `${label} must be a public HTTP(S) hostname without credentials or a custom port.`,
    );
  }
  return url;
}

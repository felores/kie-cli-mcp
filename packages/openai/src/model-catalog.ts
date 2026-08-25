import {
  type ImageOutputFormatCapability,
  type OpenAiImageAdapter,
  type OpenAiVideoAdapter,
  openAiAdapter,
  RESOLVED_OPENAI_ADAPTERS,
} from "./registry/index.js";

export type { ImageOutputFormatCapability };
export type ImageTransportModel = OpenAiImageAdapter;
export type VideoTransportModel = OpenAiVideoAdapter;
export type TransportModel = ImageTransportModel | VideoTransportModel;
export const TRANSPORT_MODEL_CATALOG = RESOLVED_OPENAI_ADAPTERS;
export type KieImageModel = string;
export type KieVideoModel = string;
export const KIE_IMAGE_MODELS = RESOLVED_OPENAI_ADAPTERS.filter(
  (m): m is OpenAiImageAdapter => m.mediaType === "image",
).map((m) => m.publicModelId);
export const KIE_VIDEO_MODELS = RESOLVED_OPENAI_ADAPTERS.filter(
  (m): m is OpenAiVideoAdapter => m.mediaType === "video",
).map((m) => m.publicModelId);
export function imageModel(id: unknown): ImageTransportModel | undefined {
  const value = openAiAdapter(id, "image");
  return value?.mediaType === "image" ? value : undefined;
}
export function videoModel(id: unknown): VideoTransportModel | undefined {
  const value = openAiAdapter(id, "video");
  return value?.mediaType === "video" ? value : undefined;
}
export function openAiModelList() {
  return {
    object: "list" as const,
    data: RESOLVED_OPENAI_ADAPTERS.slice()
      .sort(
        (a, b) =>
          a.mediaType.localeCompare(b.mediaType) ||
          a.publicModelId.localeCompare(b.publicModelId),
      )
      .map((model) => ({
        id: model.publicModelId,
        object: "model" as const,
        created: 0 as const,
        owned_by: model.ownedBy,
      })),
  };
}

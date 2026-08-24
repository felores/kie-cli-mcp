export interface ImageOutputFormatCapability {
  semanticFormat: "png" | "jpg";
  mimeType: "image/png" | "image/jpeg";
  providerFormat?: "png" | "jpg";
}

interface TransportModelBase {
  id: string;
  mediaType: "image" | "video";
  ownedBy: "kie.ai";
}

export interface ImageTransportModel extends TransportModelBase {
  mediaType: "image";
  defaultOutputFormat: ImageOutputFormatCapability;
  outputFormats: Readonly<Record<string, ImageOutputFormatCapability>>;
}

export interface VideoTransportModel extends TransportModelBase {
  mediaType: "video";
  presets: Readonly<Record<string, null>>;
}

export type TransportModel = ImageTransportModel | VideoTransportModel;

export const TRANSPORT_MODEL_CATALOG = [
  {
    id: "kie-nano-banana-image",
    mediaType: "image",
    ownedBy: "kie.ai",
    defaultOutputFormat: {
      semanticFormat: "png",
      mimeType: "image/png",
      providerFormat: "png",
    },
    outputFormats: {
      png: {
        semanticFormat: "png",
        mimeType: "image/png",
        providerFormat: "png",
      },
      jpg: {
        semanticFormat: "jpg",
        mimeType: "image/jpeg",
        providerFormat: "jpg",
      },
      jpeg: {
        semanticFormat: "jpg",
        mimeType: "image/jpeg",
        providerFormat: "jpg",
      },
    },
  },
  {
    id: "kie-gpt-image-2",
    mediaType: "image",
    ownedBy: "kie.ai",
    defaultOutputFormat: {
      semanticFormat: "png",
      mimeType: "image/png",
    },
    outputFormats: {
      png: {
        semanticFormat: "png",
        mimeType: "image/png",
      },
    },
  },
  {
    id: "kie-bytedance-video",
    mediaType: "video",
    ownedBy: "kie.ai",
    presets: { normal: null },
  },
  {
    id: "kie-bytedance-fast-video",
    mediaType: "video",
    ownedBy: "kie.ai",
    presets: { normal: null },
  },
] as const satisfies readonly TransportModel[];

export type KieImageModel = Extract<
  (typeof TRANSPORT_MODEL_CATALOG)[number],
  { mediaType: "image" }
>["id"];
export type KieVideoModel = Extract<
  (typeof TRANSPORT_MODEL_CATALOG)[number],
  { mediaType: "video" }
>["id"];

export const KIE_IMAGE_MODELS = TRANSPORT_MODEL_CATALOG.filter(
  (
    model,
  ): model is Extract<
    (typeof TRANSPORT_MODEL_CATALOG)[number],
    { mediaType: "image" }
  > => model.mediaType === "image",
).map((model) => model.id);

export const KIE_VIDEO_MODELS = TRANSPORT_MODEL_CATALOG.filter(
  (
    model,
  ): model is Extract<
    (typeof TRANSPORT_MODEL_CATALOG)[number],
    { mediaType: "video" }
  > => model.mediaType === "video",
).map((model) => model.id);

export function imageModel(id: unknown): ImageTransportModel | undefined {
  return TRANSPORT_MODEL_CATALOG.find(
    (model) => model.id === id && model.mediaType === "image",
  ) as ImageTransportModel | undefined;
}

export function videoModel(id: unknown): VideoTransportModel | undefined {
  return TRANSPORT_MODEL_CATALOG.find(
    (model) => model.id === id && model.mediaType === "video",
  ) as VideoTransportModel | undefined;
}

export function openAiModelList(): {
  object: "list";
  data: Array<{
    id: string;
    object: "model";
    created: 0;
    owned_by: string;
  }>;
} {
  return {
    object: "list",
    data: TRANSPORT_MODEL_CATALOG.map((model) => ({
      id: model.id,
      object: "model",
      created: 0,
      owned_by: model.ownedBy,
    })),
  };
}

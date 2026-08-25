import {
  ByteDanceSeedanceVideoSchema,
  ByteDanceSeedreamImageSchema,
  Flux2ImageSchema,
  FluxKontextImageSchema,
  GptImage2Schema,
  getCatalogEntry,
  getTool,
  HailuoVideoSchema,
  HappyHorseVideoSchema,
  type KieAiResponse,
  KlingVideoSchema,
  MODEL_CATALOG,
  NanoBananaImageSchema,
  QwenImageSchema,
  Veo3GenerateSchema,
  Wan27VideoSchema,
  ZImageSchema,
} from "@felores/kie-ai-core";
import type { KieAiClient } from "@felores/kie-ai-core/client";

export type OpenAiMediaType = "image" | "video";
export type StatusStrategy =
  | "jobs"
  | "veo"
  | "flux-kontext"
  | "midjourney"
  | "runway-aleph";
export type ImageOutputFormatCapability = {
  semanticFormat: "png" | "jpg";
  mimeType: "image/png" | "image/jpeg";
  providerFormat?: "png" | "jpg" | "jpeg";
};
export type ImageCardinality = {
  submission: "one-task-per-image";
  providerCount: "one";
  expectedResultsPerTask: 1;
};
export type VideoCardinality = {
  submission: "one-task-per-video";
  expectedResultsPerTask: 1;
};
export type VideoSubmissionInput = {
  prompt: string;
  preset?: string;
  duration?: number;
  aspectRatio?: string;
  resolution?: string;
  generateAudio?: boolean;
  imageUrls: string[];
  videoUrls: string[];
  audioUrls: string[];
  firstFrameUrl?: string;
  lastFrameUrl?: string;
  callbackUrl?: string;
};
export type ImageSubmissionInput = {
  prompt: string;
  aspectRatio: string;
  resolution: "1K" | "2K" | "4K";
  effectiveOutputFormat: ImageOutputFormatCapability;
  imageUrls: string[];
};
export type TaskResponse = { code: number; data?: { taskId?: string } };
export type StatusResponse = KieAiResponse<Record<string, unknown>>;

interface OpenAiAdapterBase {
  publicModelId: string;
  aliases?: readonly string[];
  toolName: string;
  mediaType: OpenAiMediaType;
  ownedBy: "kie.ai";
  apiType: string;
  statusStrategy: StatusStrategy;
  allowedResultHosts: readonly string[];
  resultHostEvidenceUrl: string;
}
export interface OpenAiImageAdapter extends OpenAiAdapterBase {
  mediaType: "image";
  operations: readonly ("generation" | "edit")[];
  maxReferences: number;
  maxReferenceBytes: number;
  providerMaxReferenceBytes?: number;
  referenceLimitEvidenceUrl?: string;
  aspectRatios: readonly string[];
  defaultAspectRatio: string;
  outputFormats: Readonly<Record<string, ImageOutputFormatCapability>>;
  defaultOutputFormat: ImageOutputFormatCapability;
  cardinality: ImageCardinality;
  supportsQuality: boolean;
  acceptedResolutions?: readonly ("1K" | "2K" | "4K")[];
  supportsCount: boolean;
  normalizeSubmission(input: ImageSubmissionInput): unknown;
  submit(client: KieAiClient, request: unknown): Promise<TaskResponse>;
}
export interface OpenAiVideoAdapter extends OpenAiAdapterBase {
  mediaType: "video";
  operations: readonly (
    | "text-to-video"
    | "image-to-video"
    | "reference-to-video"
  )[];
  presets: Readonly<Record<string, null>>;
  defaultPreset?: string;
  /** Preserve contract-2 fingerprints when a compatibility-only default is added. */
  omitDefaultPresetFromFingerprint?: boolean;
  cardinality: VideoCardinality;
  normalizeSubmission(input: VideoSubmissionInput): unknown;
  submit(client: KieAiClient, request: unknown): Promise<TaskResponse>;
}
export type OpenAiAdapter = OpenAiImageAdapter | OpenAiVideoAdapter;

const resultHosts = [
  "file.aiquickdraw.com",
  "tempfile.aiquickdraw.com",
] as const;
const temporaryResultHosts = ["tempfile.aiquickdraw.com"] as const;
const evidence = "https://docs.kie.ai/market-api/quickstart";
const generatedFileEvidence = "https://docs.kie.ai/common-api/download-url";
const imageReferenceBytes = 25 * 1024 * 1024;
const png = {
  semanticFormat: "png",
  mimeType: "image/png",
  providerFormat: "png",
} as const;
const jpg = {
  semanticFormat: "jpg",
  mimeType: "image/jpeg",
  providerFormat: "jpg",
} as const;
const jpeg = {
  semanticFormat: "jpg",
  mimeType: "image/jpeg",
  providerFormat: "jpeg",
} as const;
const commonRatios = ["1:1", "4:3", "3:4", "16:9", "9:16"] as const;
const extendedRatios = [...commonRatios, "2:3", "3:2", "21:9"] as const;
const oneImage: ImageCardinality = {
  submission: "one-task-per-image",
  providerCount: "one",
  expectedResultsPerTask: 1,
};
const oneVideo: VideoCardinality = {
  submission: "one-task-per-video",
  expectedResultsPerTask: 1,
};

export const OPENAI_ADAPTER_REGISTRY = [
  {
    publicModelId: "kie-nano-banana-image",
    toolName: "nano_banana_image",
    mediaType: "image",
    ownedBy: "kie.ai",
    apiType: "nano-banana-image",
    statusStrategy: "jobs",
    allowedResultHosts: resultHosts,
    resultHostEvidenceUrl: evidence,
    cardinality: oneImage,
    operations: ["generation", "edit"],
    maxReferences: 14,
    maxReferenceBytes: imageReferenceBytes,
    aspectRatios: [
      "auto",
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
    ],
    defaultAspectRatio: "auto",
    supportsQuality: true,
    supportsCount: true,
    defaultOutputFormat: png,
    outputFormats: { png, jpg, jpeg: jpg },
    normalizeSubmission: (input: ImageSubmissionInput) =>
      NanoBananaImageSchema.parse({
        prompt: input.prompt,
        ...(input.imageUrls.length ? { image_input: input.imageUrls } : {}),
        output_format: input.effectiveOutputFormat.providerFormat,
        aspect_ratio: input.aspectRatio,
        resolution: input.resolution,
        google_search: false,
      }),
    submit: (client: KieAiClient, request: unknown) =>
      client.generateNanoBananaImage(request as never),
  },
  {
    publicModelId: "kie-gpt-image-2",
    toolName: "gpt_image_2",
    mediaType: "image",
    ownedBy: "kie.ai",
    apiType: "gpt-image-2",
    statusStrategy: "jobs",
    allowedResultHosts: resultHosts,
    resultHostEvidenceUrl: evidence,
    cardinality: oneImage,
    operations: ["generation", "edit"],
    maxReferences: 16,
    maxReferenceBytes: imageReferenceBytes,
    aspectRatios: commonRatios,
    defaultAspectRatio: "1:1",
    supportsQuality: true,
    supportsCount: true,
    defaultOutputFormat: { semanticFormat: "png", mimeType: "image/png" },
    outputFormats: { png: { semanticFormat: "png", mimeType: "image/png" } },
    normalizeSubmission: (input: ImageSubmissionInput) =>
      GptImage2Schema.parse({
        prompt: input.prompt,
        ...(input.imageUrls.length ? { input_urls: input.imageUrls } : {}),
        aspect_ratio: input.aspectRatio,
        resolution: input.resolution,
      }),
    submit: (client: KieAiClient, request: unknown) =>
      client.generateGptImage2(request as never),
  },
  {
    publicModelId: "kie-z-image",
    toolName: "z_image",
    mediaType: "image",
    ownedBy: "kie.ai",
    apiType: "z-image",
    statusStrategy: "jobs",
    allowedResultHosts: resultHosts,
    resultHostEvidenceUrl: generatedFileEvidence,
    cardinality: oneImage,
    operations: ["generation"],
    maxReferences: 0,
    maxReferenceBytes: 0,
    aspectRatios: commonRatios,
    defaultAspectRatio: "1:1",
    supportsQuality: true,
    acceptedResolutions: ["1K"],
    supportsCount: true,
    defaultOutputFormat: { semanticFormat: "png", mimeType: "image/png" },
    outputFormats: { png: { semanticFormat: "png", mimeType: "image/png" } },
    normalizeSubmission: (input: ImageSubmissionInput) =>
      ZImageSchema.parse({
        prompt: input.prompt,
        aspect_ratio: input.aspectRatio,
      }),
    submit: (client: KieAiClient, request: unknown) =>
      client.generateZImage(request as never),
  },
  {
    publicModelId: "kie-seedream-5-pro-image",
    toolName: "bytedance_seedream_image",
    mediaType: "image",
    ownedBy: "kie.ai",
    apiType: "bytedance-seedream-image",
    statusStrategy: "jobs",
    allowedResultHosts: temporaryResultHosts,
    resultHostEvidenceUrl:
      "https://docs.kie.ai/market/seedream/5-pro-image-to-image",
    cardinality: oneImage,
    operations: ["generation", "edit"],
    maxReferences: 10,
    maxReferenceBytes: imageReferenceBytes,
    providerMaxReferenceBytes: 30 * 1024 * 1024,
    referenceLimitEvidenceUrl:
      "https://docs.kie.ai/market/seedream/5-pro-image-to-image",
    aspectRatios: extendedRatios,
    defaultAspectRatio: "1:1",
    supportsQuality: true,
    acceptedResolutions: ["1K", "2K"],
    supportsCount: true,
    defaultOutputFormat: png,
    outputFormats: { png, jpg: jpeg, jpeg },
    normalizeSubmission: (input: ImageSubmissionInput) =>
      ByteDanceSeedreamImageSchema.parse({
        version: "5-pro",
        prompt: input.prompt,
        ...(input.imageUrls.length ? { image_urls: input.imageUrls } : {}),
        aspect_ratio: input.aspectRatio,
        quality: input.resolution === "2K" ? "high" : "basic",
        output_format: input.effectiveOutputFormat.providerFormat,
        nsfw_checker: false,
      }),
    submit: (client: KieAiClient, request: unknown) =>
      client.generateByteDanceSeedreamImage(request as never),
  },
  {
    publicModelId: "kie-qwen-image",
    toolName: "qwen_image",
    mediaType: "image",
    ownedBy: "kie.ai",
    apiType: "qwen-image",
    statusStrategy: "jobs",
    allowedResultHosts: temporaryResultHosts,
    resultHostEvidenceUrl: "https://docs.kie.ai/market/qwen/image-edit",
    cardinality: oneImage,
    operations: ["generation", "edit"],
    maxReferences: 1,
    maxReferenceBytes: 10 * 1024 * 1024,
    providerMaxReferenceBytes: 10 * 1024 * 1024,
    referenceLimitEvidenceUrl: "https://docs.kie.ai/market/qwen/image-edit",
    aspectRatios: commonRatios,
    defaultAspectRatio: "1:1",
    supportsQuality: true,
    acceptedResolutions: ["1K"],
    supportsCount: true,
    defaultOutputFormat: png,
    outputFormats: { png, jpg: jpeg, jpeg },
    normalizeSubmission: (input: ImageSubmissionInput) => {
      const sizeByRatio: Record<string, string> = {
        "1:1": "square_hd",
        "4:3": "landscape_4_3",
        "3:4": "portrait_4_3",
        "16:9": "landscape_16_9",
        "9:16": "portrait_16_9",
      };
      return QwenImageSchema.parse({
        prompt: input.prompt,
        ...(input.imageUrls[0] ? { image_url: input.imageUrls[0] } : {}),
        image_size: sizeByRatio[input.aspectRatio],
        output_format: input.effectiveOutputFormat.providerFormat,
        enable_safety_checker: false,
        negative_prompt: input.imageUrls.length ? "blurry, ugly" : " ",
      });
    },
    submit: (client: KieAiClient, request: unknown) =>
      client.generateQwenImage(request as never),
  },
  {
    publicModelId: "kie-flux-2-pro-image",
    toolName: "flux2_image",
    mediaType: "image",
    ownedBy: "kie.ai",
    apiType: "flux2-image",
    statusStrategy: "jobs",
    allowedResultHosts: temporaryResultHosts,
    resultHostEvidenceUrl: "https://docs.kie.ai/market/flux2/pro-text-to-image",
    cardinality: oneImage,
    operations: ["generation", "edit"],
    maxReferences: 8,
    maxReferenceBytes: imageReferenceBytes,
    providerMaxReferenceBytes: 30 * 1024 * 1024,
    referenceLimitEvidenceUrl:
      "https://docs.kie.ai/market/flux2/pro-image-to-image",
    aspectRatios: extendedRatios.filter((ratio) => ratio !== "21:9"),
    defaultAspectRatio: "1:1",
    supportsQuality: true,
    acceptedResolutions: ["1K", "2K"],
    supportsCount: true,
    defaultOutputFormat: { semanticFormat: "png", mimeType: "image/png" },
    outputFormats: { png: { semanticFormat: "png", mimeType: "image/png" } },
    normalizeSubmission: (input: ImageSubmissionInput) =>
      Flux2ImageSchema.parse({
        prompt: input.prompt,
        ...(input.imageUrls.length ? { input_urls: input.imageUrls } : {}),
        aspect_ratio: input.aspectRatio,
        resolution: input.resolution,
        model_type: "pro",
      }),
    submit: (client: KieAiClient, request: unknown) =>
      client.generateFlux2Image(request as never),
  },
  {
    publicModelId: "kie-flux-kontext-pro-image",
    toolName: "flux_kontext_image",
    mediaType: "image",
    ownedBy: "kie.ai",
    apiType: "flux-kontext-image",
    statusStrategy: "flux-kontext",
    allowedResultHosts: temporaryResultHosts,
    resultHostEvidenceUrl: generatedFileEvidence,
    cardinality: oneImage,
    operations: ["generation", "edit"],
    maxReferences: 1,
    maxReferenceBytes: imageReferenceBytes,
    referenceLimitEvidenceUrl:
      "https://docs.kie.ai/flux-kontext-api/generate-or-edit-image",
    aspectRatios: ["21:9", ...commonRatios],
    defaultAspectRatio: "16:9",
    supportsQuality: true,
    acceptedResolutions: ["1K"],
    supportsCount: true,
    defaultOutputFormat: jpeg,
    outputFormats: { png, jpg: jpeg, jpeg },
    normalizeSubmission: (input: ImageSubmissionInput) =>
      FluxKontextImageSchema.parse({
        prompt: input.prompt,
        ...(input.imageUrls[0] ? { inputImage: input.imageUrls[0] } : {}),
        aspectRatio: input.aspectRatio,
        outputFormat: input.effectiveOutputFormat.providerFormat,
        model: "flux-kontext-pro",
        enableTranslation: true,
        promptUpsampling: false,
        uploadCn: false,
        safetyTolerance: input.imageUrls.length ? 2 : 6,
      }),
    submit: (client: KieAiClient, request: unknown) =>
      client.generateFluxKontextImage(request as never),
  },
  {
    publicModelId: "kie-bytedance-video",
    aliases: ["kie-bytedance-fast-video"],
    toolName: "bytedance_seedance_video",
    mediaType: "video",
    ownedBy: "kie.ai",
    apiType: "bytedance-seedance-video",
    statusStrategy: "jobs",
    allowedResultHosts: resultHosts,
    resultHostEvidenceUrl: evidence,
    cardinality: oneVideo,
    operations: ["text-to-video", "image-to-video", "reference-to-video"],
    presets: { normal: null },
    defaultPreset: "normal",
    omitDefaultPresetFromFingerprint: true,
    normalizeSubmission: (input: VideoSubmissionInput) =>
      ByteDanceSeedanceVideoSchema.parse({
        prompt: input.prompt,
        ...(input.duration !== undefined ? { duration: input.duration } : {}),
        ...(input.aspectRatio ? { aspect_ratio: input.aspectRatio } : {}),
        ...(input.resolution ? { resolution: input.resolution } : {}),
        ...(input.generateAudio !== undefined
          ? { generate_audio: input.generateAudio }
          : {}),
        ...(input.imageUrls.length
          ? { reference_image_urls: input.imageUrls }
          : {}),
        ...(input.videoUrls.length
          ? { reference_video_urls: input.videoUrls }
          : {}),
        ...(input.audioUrls.length
          ? { reference_audio_urls: input.audioUrls }
          : {}),
        ...(input.firstFrameUrl
          ? { first_frame_url: input.firstFrameUrl }
          : {}),
        ...(input.lastFrameUrl ? { last_frame_url: input.lastFrameUrl } : {}),
        ...(input.callbackUrl ? { callBackUrl: input.callbackUrl } : {}),
      }),
    submit: (client: KieAiClient, request: unknown) =>
      client.generateByteDanceSeedanceVideo(request as never),
  },
  {
    publicModelId: "kie-kling-3-video",
    toolName: "kling_video",
    mediaType: "video",
    ownedBy: "kie.ai",
    apiType: "kling-3.0-video",
    statusStrategy: "jobs",
    allowedResultHosts: resultHosts,
    resultHostEvidenceUrl: evidence,
    cardinality: oneVideo,
    operations: ["text-to-video", "image-to-video"],
    presets: { std: null, pro: null },
    defaultPreset: "std",
    normalizeSubmission: (input: VideoSubmissionInput) => {
      if (input.videoUrls.length || input.audioUrls.length) {
        throw new Error(
          "Kling OpenAI video requests support image references only.",
        );
      }
      if (input.resolution) {
        throw new Error(
          "Kling does not expose resolution_name through the OpenAI video route.",
        );
      }
      const imageUrls = [
        ...input.imageUrls,
        ...(input.firstFrameUrl ? [input.firstFrameUrl] : []),
        ...(input.lastFrameUrl ? [input.lastFrameUrl] : []),
      ];
      if (imageUrls.length > 2) {
        throw new Error("Kling accepts at most two image references.");
      }
      return KlingVideoSchema.parse({
        prompt: input.prompt,
        ...(imageUrls.length ? { image_urls: imageUrls } : {}),
        duration: String(input.duration ?? 5),
        aspect_ratio: input.aspectRatio ?? "16:9",
        mode: input.preset ?? "std",
        sound: input.generateAudio ?? false,
        ...(input.callbackUrl ? { callBackUrl: input.callbackUrl } : {}),
      });
    },
    submit: (client: KieAiClient, request: unknown) =>
      client.generateKlingVideo(request as never),
  },
  {
    publicModelId: "kie-minimax-h3-video",
    toolName: "hailuo_video",
    mediaType: "video",
    ownedBy: "kie.ai",
    apiType: "hailuo",
    statusStrategy: "jobs",
    allowedResultHosts: resultHosts,
    resultHostEvidenceUrl:
      "https://docs.kie.ai/market/minimax-h3/reference-to-video",
    cardinality: oneVideo,
    operations: ["text-to-video", "image-to-video", "reference-to-video"],
    presets: {
      "text-to-video": null,
      "image-to-video": null,
      "reference-to-video": null,
    },
    normalizeSubmission: (input: VideoSubmissionInput) => {
      if (input.generateAudio !== undefined) {
        throw new Error(
          "MiniMax H3 does not expose generate_audio through the OpenAI video route.",
        );
      }
      if (input.firstFrameUrl || input.lastFrameUrl) {
        if (
          input.imageUrls.length ||
          input.videoUrls.length ||
          input.audioUrls.length
        ) {
          throw new Error(
            "MiniMax H3 frame inputs cannot be combined with other references.",
          );
        }
      }
      const frameImages = [
        ...(input.firstFrameUrl ? [input.firstFrameUrl] : []),
        ...(input.lastFrameUrl ? [input.lastFrameUrl] : []),
      ];
      const imageUrls = [...input.imageUrls, ...frameImages];
      const hasReferenceInputs = Boolean(
        input.videoUrls.length || input.audioUrls.length,
      );
      const inferredPreset =
        input.preset ??
        (hasReferenceInputs || imageUrls.length > 2
          ? "reference-to-video"
          : imageUrls.length
            ? "image-to-video"
            : "text-to-video");
      if (
        inferredPreset === "text-to-video" &&
        (imageUrls.length || hasReferenceInputs)
      ) {
        throw new Error("Text-to-video does not accept reference files.");
      }
      if (inferredPreset === "image-to-video") {
        if (
          hasReferenceInputs ||
          imageUrls.length < 1 ||
          imageUrls.length > 2
        ) {
          throw new Error(
            "MiniMax H3 image-to-video accepts one start frame and one optional end frame.",
          );
        }
        if (input.aspectRatio || input.resolution) {
          throw new Error(
            "MiniMax H3 image-to-video does not accept size or resolution_name.",
          );
        }
      }
      if (
        inferredPreset === "reference-to-video" &&
        !hasReferenceInputs &&
        imageUrls.length === 0
      ) {
        throw new Error(
          "Reference-to-video requires at least one reference file.",
        );
      }
      return HailuoVideoSchema.parse({
        prompt: input.prompt,
        duration: input.duration ?? 5,
        ...(inferredPreset === "image-to-video"
          ? {
              imageUrl: imageUrls[0],
              ...(imageUrls[1] ? { endImageUrl: imageUrls[1] } : {}),
            }
          : inferredPreset === "reference-to-video"
            ? {
                ...(imageUrls.length ? { referenceImageUrls: imageUrls } : {}),
                ...(input.videoUrls.length
                  ? { referenceVideoUrls: input.videoUrls }
                  : {}),
                ...(input.audioUrls.length
                  ? { referenceAudioUrls: input.audioUrls }
                  : {}),
                ...(input.aspectRatio
                  ? { aspectRatio: input.aspectRatio }
                  : {}),
                ...(input.resolution ? { resolution: input.resolution } : {}),
              }
            : { aspectRatio: input.aspectRatio ?? "16:9" }),
        ...(input.callbackUrl ? { callBackUrl: input.callbackUrl } : {}),
      });
    },
    submit: (client: KieAiClient, request: unknown) =>
      client.generateHailuoVideo(request as never),
  },
  {
    publicModelId: "kie-veo3-video",
    toolName: "veo3_generate_video",
    mediaType: "video",
    ownedBy: "kie.ai",
    apiType: "veo3",
    statusStrategy: "veo",
    allowedResultHosts: resultHosts,
    resultHostEvidenceUrl: "https://docs.kie.ai/veo3-api/quickstart",
    cardinality: oneVideo,
    operations: ["text-to-video", "image-to-video"],
    presets: { veo3: null, veo3_fast: null },
    defaultPreset: "veo3",
    normalizeSubmission: (input: VideoSubmissionInput) => {
      if (input.duration !== undefined) {
        throw new Error(
          "Veo3 does not expose seconds through the OpenAI video route.",
        );
      }
      if (input.resolution || input.generateAudio !== undefined) {
        throw new Error(
          "Veo3 does not expose resolution_name or generate_audio through the OpenAI video route.",
        );
      }
      if (input.videoUrls.length || input.audioUrls.length) {
        throw new Error("Veo3 accepts image references only.");
      }
      const imageUrls = [
        ...input.imageUrls,
        ...(input.firstFrameUrl ? [input.firstFrameUrl] : []),
        ...(input.lastFrameUrl ? [input.lastFrameUrl] : []),
      ];
      return Veo3GenerateSchema.parse({
        prompt: input.prompt,
        ...(imageUrls.length ? { imageUrls } : {}),
        model: input.preset ?? "veo3",
        aspectRatio: input.aspectRatio ?? "16:9",
        enableFallback: false,
        enableTranslation: true,
        ...(input.callbackUrl ? { callBackUrl: input.callbackUrl } : {}),
      });
    },
    submit: (client: KieAiClient, request: unknown) =>
      client.generateVeo3Video(request as never),
  },
  {
    publicModelId: "kie-wan-2-7-video",
    toolName: "wan_video",
    mediaType: "video",
    ownedBy: "kie.ai",
    apiType: "wan-video",
    statusStrategy: "jobs",
    allowedResultHosts: resultHosts,
    resultHostEvidenceUrl: evidence,
    cardinality: oneVideo,
    operations: ["text-to-video", "image-to-video", "reference-to-video"],
    presets: {
      "text-to-video": null,
      "image-to-video": null,
      "reference-to-video": null,
    },
    normalizeSubmission: (input: VideoSubmissionInput) => {
      if (input.generateAudio !== undefined) {
        throw new Error(
          "Wan does not expose generate_audio through the OpenAI video route.",
        );
      }
      if (input.audioUrls.length > 1) {
        throw new Error("Wan accepts at most one audio reference.");
      }
      const imageUrls = [
        ...input.imageUrls,
        ...(input.firstFrameUrl ? [input.firstFrameUrl] : []),
        ...(input.lastFrameUrl ? [input.lastFrameUrl] : []),
      ];
      const hasReferenceInputs = Boolean(
        input.videoUrls.length || imageUrls.length > 2,
      );
      const inferredPreset =
        input.preset ??
        (hasReferenceInputs
          ? "reference-to-video"
          : imageUrls.length
            ? "image-to-video"
            : "text-to-video");
      if (
        inferredPreset === "text-to-video" &&
        (imageUrls.length || input.videoUrls.length)
      ) {
        throw new Error("Text-to-video does not accept reference files.");
      }
      if (inferredPreset === "image-to-video") {
        if (
          input.videoUrls.length ||
          imageUrls.length < 1 ||
          imageUrls.length > 2
        ) {
          throw new Error(
            "Wan image-to-video accepts one or two image references.",
          );
        }
      }
      if (
        inferredPreset === "reference-to-video" &&
        !imageUrls.length &&
        !input.videoUrls.length
      ) {
        throw new Error(
          "Reference-to-video requires at least one reference file.",
        );
      }
      const request: Record<string, unknown> = {
        mode: inferredPreset,
        prompt: input.prompt,
        ...(input.duration !== undefined ? { duration: input.duration } : {}),
        ...(input.aspectRatio ? { ratio: input.aspectRatio } : {}),
        ...(input.resolution ? { resolution: input.resolution } : {}),
      };
      if (inferredPreset === "image-to-video") {
        request.first_frame_url = imageUrls[0];
        if (imageUrls[1]) request.last_frame_url = imageUrls[1];
      } else if (inferredPreset === "reference-to-video") {
        if (imageUrls.length) request.reference_image = imageUrls;
        if (input.videoUrls.length) request.reference_video = input.videoUrls;
        if (input.firstFrameUrl) request.first_frame = input.firstFrameUrl;
      }
      if (input.audioUrls.length) request.audio_url = input.audioUrls[0];
      if (input.callbackUrl) request.callBackUrl = input.callbackUrl;
      return Wan27VideoSchema.parse(request);
    },
    submit: (client: KieAiClient, request: unknown) =>
      client.generateWanVideo(request as never),
  },
  {
    publicModelId: "kie-happyhorse-1-0-video",
    toolName: "happyhorse_video",
    mediaType: "video",
    ownedBy: "kie.ai",
    apiType: "happyhorse-video",
    statusStrategy: "jobs",
    allowedResultHosts: resultHosts,
    resultHostEvidenceUrl: evidence,
    cardinality: oneVideo,
    operations: ["text-to-video", "image-to-video", "reference-to-video"],
    presets: {
      "text-to-video": null,
      "image-to-video": null,
      "reference-to-video": null,
    },
    normalizeSubmission: (input: VideoSubmissionInput) => {
      if (
        input.generateAudio !== undefined ||
        input.videoUrls.length ||
        input.audioUrls.length
      ) {
        throw new Error(
          "HappyHorse supports image references only through the OpenAI video route.",
        );
      }
      const imageUrls = [
        ...input.imageUrls,
        ...(input.firstFrameUrl ? [input.firstFrameUrl] : []),
        ...(input.lastFrameUrl ? [input.lastFrameUrl] : []),
      ];
      const inferredPreset =
        input.preset ??
        (imageUrls.length > 1
          ? "reference-to-video"
          : imageUrls.length
            ? "image-to-video"
            : "text-to-video");
      if (inferredPreset === "text-to-video" && imageUrls.length) {
        throw new Error("Text-to-video does not accept reference images.");
      }
      if (inferredPreset === "image-to-video" && imageUrls.length !== 1) {
        throw new Error(
          "HappyHorse image-to-video accepts one image reference.",
        );
      }
      if (inferredPreset === "reference-to-video" && !imageUrls.length) {
        throw new Error(
          "Reference-to-video requires at least one image reference.",
        );
      }
      if (input.lastFrameUrl) {
        throw new Error("HappyHorse does not expose a last-frame input.");
      }
      return HappyHorseVideoSchema.parse({
        mode: inferredPreset,
        prompt: input.prompt,
        ...(inferredPreset === "image-to-video"
          ? { image_urls: imageUrls }
          : inferredPreset === "reference-to-video"
            ? { reference_image: imageUrls }
            : {}),
        ...(input.resolution ? { resolution: input.resolution } : {}),
        ...(input.aspectRatio ? { aspect_ratio: input.aspectRatio } : {}),
        ...(input.duration !== undefined ? { duration: input.duration } : {}),
        ...(input.callbackUrl ? { callBackUrl: input.callbackUrl } : {}),
      });
    },
    submit: (client: KieAiClient, request: unknown) =>
      client.generateHappyHorseVideo(request as never),
  },
] as const satisfies readonly OpenAiAdapter[];

export const OPENAI_EXCLUSIONS: Readonly<Record<string, string>> = {
  topaz_upscale_image:
    "utility transformation is not mapped to standard image routes",
  ideogram_reframe: "reframe transformation has a specialized input contract",
  recraft_remove_background:
    "transparent-background workflow is outside this contract",
  midjourney_generate:
    "mixed image/video modes require explicit route mappings",
  wan_animate: "character animation has a specialized media contract",
  runway_aleph_video: "video transformation is not standard create-video",
  grok_imagine: "mixed image/video/upscale modes require explicit descriptors",
  infinitalk_lip_sync: "avatar workflow requires image and audio contracts",
  kling_avatar: "avatar workflow requires image and audio contracts",
  omnihuman_video: "avatar workflow requires image and audio contracts",
  gemini_omni: "mixed character, voice, and video workflow",
};
const strategies = new Set<StatusStrategy>([
  "jobs",
  "veo",
  "flux-kontext",
  "midjourney",
  "runway-aleph",
]);

export const OPENAI_STATUS_STRATEGIES: Readonly<
  Partial<
    Record<
      StatusStrategy,
      (
        client: KieAiClient,
        taskId: string,
        apiType: string,
      ) => Promise<StatusResponse>
    >
  >
> = {
  jobs: (client, taskId, apiType) => client.getTaskStatus(taskId, apiType),
  veo: async (client, taskId, apiType) => {
    const response = await client.getTaskStatus(taskId, apiType);
    const data = response.data;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return response;
    }
    const normalizedData = { ...data } as Record<string, unknown>;
    const successFlag = normalizedData.successFlag;
    if (successFlag === 0) normalizedData.state = "waiting";
    else if (successFlag === 2 || successFlag === 3) {
      normalizedData.state = "fail";
    } else if (successFlag === 1) {
      normalizedData.state = "success";
      const resultValue =
        normalizedData.resultUrls ??
        (typeof normalizedData.response === "object" &&
        normalizedData.response !== null &&
        !Array.isArray(normalizedData.response)
          ? (normalizedData.response as Record<string, unknown>).resultUrls
          : undefined);
      if (typeof resultValue === "string") {
        try {
          normalizedData.resultJson = JSON.stringify({
            resultUrls: JSON.parse(resultValue),
          });
        } catch {
          normalizedData.resultJson = resultValue;
        }
      } else if (Array.isArray(resultValue)) {
        normalizedData.resultJson = JSON.stringify({
          resultUrls: resultValue,
        });
      }
    }
    return { ...response, data: normalizedData };
  },
  "flux-kontext": (client, taskId, apiType) =>
    client.getTaskStatus(taskId, apiType),
};

export function pollOpenAiAdapterStatus(
  adapter: OpenAiAdapter,
  client: KieAiClient,
  taskId: string,
): Promise<StatusResponse> {
  const strategy = OPENAI_STATUS_STRATEGIES[adapter.statusStrategy];
  if (!strategy) {
    throw new Error(
      `Unsupported OpenAI status strategy: ${adapter.statusStrategy}`,
    );
  }
  return strategy(client, taskId, adapter.apiType);
}
function validHost(host: string): boolean {
  return (
    /^[a-z0-9.-]+$/i.test(host) &&
    !host.includes("..") &&
    !host.includes("localhost") &&
    !host.includes(":") &&
    !/^\d/.test(host)
  );
}
function resolveAdapter(adapter: OpenAiAdapter): OpenAiAdapter {
  const catalog = getCatalogEntry(adapter.toolName);
  const tool = getTool(adapter.toolName);
  if (catalog?.status !== "active")
    throw new Error(
      `OpenAI adapter ${adapter.publicModelId} has no active catalog entry.`,
    );
  if (!tool || tool.category !== adapter.mediaType)
    throw new Error(
      `OpenAI adapter ${adapter.publicModelId} does not match a registered ${adapter.mediaType} tool.`,
    );
  if (
    !strategies.has(adapter.statusStrategy) ||
    !OPENAI_STATUS_STRATEGIES[adapter.statusStrategy] ||
    !adapter.apiType
  )
    throw new Error(
      `OpenAI adapter ${adapter.publicModelId} has no valid status strategy.`,
    );
  if (
    !adapter.resultHostEvidenceUrl.startsWith("https://") ||
    adapter.allowedResultHosts.length === 0 ||
    adapter.allowedResultHosts.some((host) => !validHost(host))
  )
    throw new Error(
      `OpenAI adapter ${adapter.publicModelId} has an invalid result-host policy.`,
    );
  if (
    !adapter.operations.length ||
    !adapter.cardinality ||
    !adapter.normalizeSubmission ||
    !adapter.submit ||
    (adapter.mediaType === "video" &&
      adapter.defaultPreset !== undefined &&
      !Object.hasOwn(adapter.presets, adapter.defaultPreset)) ||
    (adapter.mediaType === "image" &&
      (adapter.maxReferences < 0 ||
        adapter.maxReferenceBytes < 0 ||
        (adapter.providerMaxReferenceBytes !== undefined &&
          (adapter.providerMaxReferenceBytes < adapter.maxReferenceBytes ||
            !adapter.referenceLimitEvidenceUrl?.startsWith("https://"))) ||
        adapter.aspectRatios.length === 0 ||
        !adapter.aspectRatios.includes(adapter.defaultAspectRatio)))
  )
    throw new Error(
      `OpenAI adapter ${adapter.publicModelId} is not executable.`,
    );
  return adapter;
}
const ids = new Set<string>();
const registry: readonly OpenAiAdapter[] = OPENAI_ADAPTER_REGISTRY;
export const RESOLVED_OPENAI_ADAPTERS = registry
  .flatMap((adapter) => [
    adapter,
    ...(adapter.aliases ?? []).map((alias: string) => ({
      ...adapter,
      publicModelId: alias,
      aliases: undefined,
    })),
  ])
  .map((adapter) => {
    if (ids.has(adapter.publicModelId))
      throw new Error(
        `Duplicate OpenAI public model ID: ${adapter.publicModelId}`,
      );
    ids.add(adapter.publicModelId);
    return resolveAdapter(adapter);
  });
export function openAiAdapter(
  id: unknown,
  mediaType?: OpenAiMediaType,
): OpenAiAdapter | undefined {
  return RESOLVED_OPENAI_ADAPTERS.find(
    (adapter) =>
      adapter.publicModelId === id &&
      (!mediaType || adapter.mediaType === mediaType),
  );
}
export function canonicalModelId(id: string): string {
  return (
    registry.find((a) => a.publicModelId === id || a.aliases?.includes(id))
      ?.publicModelId ?? id
  );
}
export function activeCoreMediaTools(): string[] {
  return MODEL_CATALOG.filter(
    (e) =>
      e.status === "active" &&
      (getTool(e.toolName)?.category === "image" ||
        getTool(e.toolName)?.category === "video"),
  ).map((e) => e.toolName);
}
export function unaccountedCoreMediaTools(): string[] {
  const adapted = new Set(RESOLVED_OPENAI_ADAPTERS.map((a) => a.toolName));
  return activeCoreMediaTools().filter(
    (name) => !adapted.has(name) && !OPENAI_EXCLUSIONS[name],
  );
}

const activeMediaToolNames = new Set(activeCoreMediaTools());
const adaptedToolNames = new Set(
  RESOLVED_OPENAI_ADAPTERS.map((adapter) => adapter.toolName),
);
for (const [toolName, reason] of Object.entries(OPENAI_EXCLUSIONS)) {
  if (
    !activeMediaToolNames.has(toolName) ||
    adaptedToolNames.has(toolName) ||
    !reason.trim()
  ) {
    throw new Error(`Invalid OpenAI exclusion: ${toolName}`);
  }
}
const unaccounted = unaccountedCoreMediaTools();
if (unaccounted.length > 0) {
  throw new Error(
    `Unaccounted active OpenAI media tools: ${unaccounted.join(", ")}`,
  );
}
export function registrySummary(): string {
  return `active core media tools: ${activeCoreMediaTools().length}\nadapted tool families: ${new Set(RESOLVED_OPENAI_ADAPTERS.map((a) => a.toolName)).size}\npublic OpenAI model IDs: ${RESOLVED_OPENAI_ADAPTERS.length}\nexplicit exclusions: ${Object.keys(OPENAI_EXCLUSIONS).length}\nunaccounted active media tools: ${unaccountedCoreMediaTools().length}`;
}

import {
  ByteDanceSeedanceVideoSchema,
  ByteDanceSeedreamImageSchema,
  Flux2ImageSchema,
  FluxKontextImageSchema,
  GptImage2Schema,
  getCatalogEntry,
  getTool,
  type KieAiResponse,
  MODEL_CATALOG,
  NanoBananaImageSchema,
  QwenImageSchema,
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
] as const satisfies readonly OpenAiAdapter[];

export const OPENAI_EXCLUSIONS: Readonly<Record<string, string>> = {
  topaz_upscale_image:
    "utility transformation is not mapped to standard image routes",
  ideogram_reframe: "reframe transformation has a specialized input contract",
  recraft_remove_background:
    "transparent-background workflow is outside this contract",
  midjourney_generate:
    "mixed image/video modes require explicit route mappings",
  veo3_generate_video: "requires dedicated Veo status strategy coverage",
  kling_video: "requires a dedicated video adapter",
  hailuo_video: "requires a dedicated video adapter",
  wan_video: "includes specialized editing modes",
  wan_animate: "character animation has a specialized media contract",
  happyhorse_video: "includes specialized editing modes",
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

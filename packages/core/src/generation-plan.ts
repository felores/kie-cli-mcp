import { createHash, randomUUID } from "crypto";
import type { z } from "zod";
import { getCatalogEntry } from "./model-catalog.js";
import { priceRequest, type PriceState } from "./pricing/rate-card.js";
import type { ToolDef } from "./tools/types.js";

export interface PreparedPlanItem {
  index: number;
  tool: string;
  model: string;
  mode: string;
  outputCount: number;
  userSettings: Record<string, unknown>;
  appliedDefaults: Record<string, unknown>;
  effectiveSettings: Record<string, unknown>;
  price: PriceState;
}

export interface PreparedGenerationPlan {
  id: string;
  createdAt: string;
  expiresAt: string;
  defaultProfile: "safe";
  maxConcurrency: number;
  items: PreparedPlanItem[];
  total: { credits?: number; status: "exact" | "unknown" };
  requestHash: string;
}

const POLICY_DEFAULTS: Record<string, Record<string, unknown>> = {
  "image-fast": { model: "nano-banana-2-lite", resolution: "1K" },
  "seedance-safe": { resolution: "720p", duration: 5, generate_audio: false },
  "kling-safe": { mode: "std", duration: "5", sound: false },
  "veo-fast": { model: "veo3_fast" },
  "hailuo-safe": { duration: 5, aspectRatio: "16:9" },
};

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function hashPlanPayload(payload: Omit<PreparedGenerationPlan, "id" | "requestHash">): string {
  return createHash("sha256").update(stableJson(payload)).digest("hex");
}

function hasValues(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

/** Mirrors provider route selection without exposing incidental quality/style fields as a mode. */
export function resolveGenerationMode(tool: string, args: Record<string, unknown>): string {
  switch (tool) {
    case "nano_banana_image":
      return hasValues(args.image_input) ? "image-to-image" : "text-to-image";
    case "bytedance_seedream_image":
      return hasValues(args.image_urls) ? "image-to-image" : "text-to-image";
    case "qwen_image":
      return args.image_url ? "image-to-image" : "text-to-image";
    case "gpt_image_2":
      return hasValues(args.input_urls) ? "image-to-image" : "text-to-image";
    case "flux_kontext_image":
      return args.inputImage ? "image-to-image" : "text-to-image";
    case "flux2_image":
      return hasValues(args.input_urls) ? "image-to-image" : "text-to-image";
    case "midjourney_generate": {
      const taskTypeModes: Record<string, string> = {
        mj_txt2img: "text-to-image",
        mj_img2img: "image-to-image",
        mj_style_reference: "style-reference",
        mj_omni_reference: "omni-reference",
        mj_video: "image-to-video",
        mj_video_hd: "image-to-hd-video",
      };
      if (typeof args.taskType === "string" && taskTypeModes[args.taskType]) {
        return taskTypeModes[args.taskType];
      }
      if (args.ow) return "omni-reference";
      if (args.motion || args.videoBatchSize || args.high_definition_video) {
        return args.high_definition_video ? "image-to-hd-video" : "image-to-video";
      }
      return args.fileUrl || hasValues(args.fileUrls) ? "image-to-image" : "text-to-image";
    }
    case "grok_imagine":
      if (typeof args.generation_mode === "string") return args.generation_mode;
      if (args.task_id && !args.prompt && !hasValues(args.image_urls)) return "upscale";
      return args.task_id || hasValues(args.image_urls) ? "image-to-video" : "text-to-video";
    case "hailuo_video":
      return args.imageUrl ? "image-to-video" : hasValues(args.referenceImageUrls) || hasValues(args.referenceVideoUrls) || hasValues(args.referenceAudioUrls) ? "reference-to-video" : "text-to-video";
    case "bytedance_seedance_video":
      return args.first_frame_url ? "image-to-video" : hasValues(args.reference_image_urls) || hasValues(args.reference_video_urls) || hasValues(args.reference_audio_urls) ? "reference-to-video" : "text-to-video";
    case "veo3_generate_video":
      return hasValues(args.imageUrls) ? "image-to-video" : "text-to-video";
    case "kling_video":
      return args.multi_shots ? "multi-shot" : hasValues(args.image_urls) ? "image-to-video" : "text-to-video";
    case "wan_video":
      if (typeof args.mode === "string") return args.mode;
      return args.video_url_edit ? "video-edit" : hasValues(args.reference_image) || hasValues(args.reference_video) ? "reference-to-video" : args.first_frame_url || args.last_frame_url || args.first_clip_url ? "image-to-video" : "text-to-video";
    case "happyhorse_video":
      if (typeof args.mode === "string") return args.mode;
      return args.video_url ? "video-edit" : hasValues(args.reference_image) ? "reference-to-video" : hasValues(args.image_urls) ? "image-to-video" : "text-to-video";
    case "wan_animate":
      return args.mode === "replace" ? "character-replacement" : "animation";
    case "gemini_omni":
      return args.operation === "character" ? "character" : args.operation === "audio" ? "audio" : "video";
    case "infinitalk_lip_sync":
    case "kling_avatar":
    case "omnihuman_video":
      return "lip-sync";
    case "runway_aleph_video":
      return "video-edit";
    case "topaz_upscale_image":
      return "upscale";
    case "ideogram_reframe":
      return "reframe";
    case "recraft_remove_background":
      return "background-removal";
    case "suno_generate_music":
      return "music-generation";
    case "elevenlabs_tts":
      return "text-to-speech";
    case "elevenlabs_ttsfx":
      return "sound-effects";
    default:
      return "generate";
  }
}

function resolveModel(tool: string, parsed: Record<string, unknown>): string {
  const catalog = getCatalogEntry(tool);
  if (tool === "nano_banana_image" || tool === "veo3_generate_video") return String(parsed.model);
  return catalog?.model ?? tool;
}

function resolveOutputCount(args: Record<string, unknown>): number {
  for (const key of ["max_images", "num_images", "videoBatchSize", "repeat"]) {
    const value = args[key];
    const count = typeof value === "number" ? value : Number(value);
    if (Number.isInteger(count) && count > 0) return count;
  }
  return 1;
}

function toolSchemaDefaults(schema: z.ZodTypeAny, before: Record<string, unknown>, parsed: Record<string, unknown>): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!(key in before)) defaults[key] = value;
  }
  return defaults;
}

export function prepareGenerationPlan(
  requestedItems: Array<{ tool: string; args: Record<string, unknown> }>,
  tools: Map<string, ToolDef>,
  options: { defaultProfile?: "safe"; maxConcurrency?: number; expiresInSeconds?: number } = {},
): PreparedGenerationPlan {
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + (options.expiresInSeconds ?? 15 * 60) * 1000).toISOString();
  const maxConcurrency = Math.min(4, Math.max(1, options.maxConcurrency ?? 4));
  const defaultProfile = options.defaultProfile ?? "safe";
  const items = requestedItems.map((requested, index) => {
    const tool = tools.get(requested.tool);
    const catalog = getCatalogEntry(requested.tool);
    if (!tool || !catalog) throw new Error(`Unsupported generation tool: ${requested.tool}`);
    const profileDefaults = catalog.defaultProfile ? POLICY_DEFAULTS[catalog.defaultProfile] ?? {} : {};
    const isHailuoNonTextMode = requested.tool === "hailuo_video" && (
      requested.args.imageUrl ||
      hasValues(requested.args.referenceImageUrls) ||
      hasValues(requested.args.referenceVideoUrls) ||
      hasValues(requested.args.referenceAudioUrls)
    );
    const applicableProfileDefaults = isHailuoNonTextMode
      ? Object.fromEntries(Object.entries(profileDefaults).filter(([key]) => key !== "aspectRatio"))
      : profileDefaults;
    const policyApplied = Object.fromEntries(Object.entries(applicableProfileDefaults).filter(([key]) => requested.args[key] === undefined));
    const beforeParse = { ...policyApplied, ...requested.args };
    const parsed = tool.schema.parse(beforeParse) as Record<string, unknown>;
    const appliedDefaults = { ...policyApplied, ...toolSchemaDefaults(tool.schema, beforeParse, parsed) };
    const model = resolveModel(requested.tool, parsed);
    const mode = resolveGenerationMode(requested.tool, parsed);
    const outputCount = resolveOutputCount(parsed);
    const price = priceRequest(requested.tool, { ...parsed, outputCount }, model, mode);
    return { index, tool: requested.tool, model, mode, outputCount, userSettings: requested.args, appliedDefaults, effectiveSettings: parsed, price };
  });
  const exact = items.every((item) => item.price.status === "exact");
  const totalCredits = exact ? items.reduce((sum, item) => sum + (item.price.credits ?? 0), 0) : undefined;
  const payload = { createdAt, expiresAt, defaultProfile, maxConcurrency, items, total: exact ? { credits: totalCredits, status: "exact" as const } : { status: "unknown" as const } };
  return { id: randomUUID(), ...payload, requestHash: hashPlanPayload(payload) };
}

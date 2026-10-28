export type PriceStatus = "exact" | "estimated" | "unknown";

export interface PriceState {
  status: PriceStatus;
  credits?: number;
  sourceUrl?: string;
  sourceFingerprint?: string;
  verifiedAt?: string;
  rateCardVersion: string;
}

export interface RateCardEntry {
  toolName: string;
  /** The provider route scope that has a verified formula for specific inputs. */
  scope: string;
  name: string;
  sourceUrl: string;
  sourceFingerprint: string;
  verifiedAt: string;
  matches(args: Record<string, unknown>, model: string, mode: string): boolean;
  credits(args: Record<string, unknown>): number | undefined;
}

export const RATE_CARD_VERSION = "2026-10-28";

const GPT_IMAGE_CREDITS: Record<string, number> = {
  "1K": 6,
  "2K": 10,
  "4K": 16,
};

function isGptImageResolution(value: unknown): boolean {
  return typeof value === "string" && value in GPT_IMAGE_CREDITS;
}

function perImage(credits: number) {
  return (args: Record<string, unknown>) =>
    credits * Number(args.outputCount ?? 1);
}

const SEEDANCE_RATES: Record<string, number> = {
  "480p": 28,
  "720p": 63,
  "1080p": 158,
};

function seedanceRate(value: unknown): number | undefined {
  return typeof value === "string"
    ? SEEDANCE_RATES[value.toLowerCase()]
    : undefined;
}

function seedanceEntry(scope: string): RateCardEntry {
  return {
    toolName: "bytedance_seedance_video",
    scope,
    name: "ByteDance Seedance 2.5 without reference video",
    sourceUrl: "https://kie.ai/seedance-2-5",
    sourceFingerprint:
      "kie-seedance-2-5-2026-10-28:per-second-without-video:28-63-158",
    verifiedAt: "2026-10-28",
    matches: (args, model) =>
      model === "bytedance/seedance-2-5" &&
      seedanceRate(args.resolution) !== undefined &&
      typeof args.duration === "number" &&
      !(
        Array.isArray(args.reference_video_urls) &&
        args.reference_video_urls.length > 0
      ),
    credits: (args) => {
      const rate = seedanceRate(args.resolution);
      return rate === undefined ? undefined : rate * Number(args.duration);
    },
  };
}

export const RATE_CARD: RateCardEntry[] = [
  {
    toolName: "nano_banana_image",
    scope: "text-to-image",
    name: "Nano Banana 2 Lite image",
    sourceUrl: "https://kie.ai/pricing",
    sourceFingerprint: "kie-pricing-2026-08-17:nano-banana-2-lite:4-per-image",
    verifiedAt: "2026-08-17",
    matches: (args, model, mode) =>
      mode === "text-to-image" &&
      model === "nano-banana-2-lite" &&
      Number(args.outputCount ?? 1) === 1,
    credits: () => 4,
  },
  {
    toolName: "hailuo_video",
    scope: "reference-to-video",
    name: "MiniMax H3 reference-to-video at 768p",
    sourceUrl: "https://kie.ai/pricing",
    sourceFingerprint:
      "kie-pricing-2026-08-17:minimax-h3-reference-768p:16-per-second",
    verifiedAt: "2026-08-17",
    matches: (args, _model, mode) =>
      mode === "reference-to-video" &&
      args.resolution === "768p" &&
      typeof args.duration === "number",
    credits: (args) =>
      typeof args.duration === "number" ? args.duration * 16 : undefined,
  },
  {
    toolName: "gpt_image",
    scope: "text-to-image",
    name: "GPT Image 2.5 Flare and Sunburst",
    sourceUrl: "https://kie.ai/pricing",
    sourceFingerprint: "kie-pricing-2026-10-27:gpt-image-2-5:6-10-16-per-image",
    verifiedAt: "2026-10-27",
    matches: (args, model, mode) =>
      mode === "text-to-image" &&
      model.startsWith("gpt-image-2-5-") &&
      isGptImageResolution(args.resolution) &&
      Number(args.outputCount ?? 1) === 1,
    credits: (args) => GPT_IMAGE_CREDITS[String(args.resolution)],
  },
  {
    toolName: "gpt_image",
    scope: "image-to-image",
    name: "GPT Image 2.5 Flare and Sunburst",
    sourceUrl: "https://kie.ai/pricing",
    sourceFingerprint: "kie-pricing-2026-10-27:gpt-image-2-5:6-10-16-per-image",
    verifiedAt: "2026-10-27",
    matches: (args, model, mode) =>
      mode === "image-to-image" &&
      model.startsWith("gpt-image-2-5-") &&
      isGptImageResolution(args.resolution) &&
      Number(args.outputCount ?? 1) === 1,
    credits: (args) => GPT_IMAGE_CREDITS[String(args.resolution)],
  },
  {
    toolName: "wan_image",
    scope: "text-to-image",
    name: "Wan 2.7 Image Pro",
    sourceUrl: "https://kie.ai/pricing",
    sourceFingerprint: "kie-pricing-2026-10-28:wan-2-7-image-pro:12-per-image",
    verifiedAt: "2026-10-28",
    matches: (_args, model) => model === "wan/2-7-image-pro",
    credits: perImage(12),
  },
  {
    toolName: "wan_image",
    scope: "text-to-image",
    name: "Wan 2.7 Image",
    sourceUrl: "https://kie.ai/pricing",
    sourceFingerprint: "kie-pricing-2026-10-28:wan-2-7-image:4.8-per-image",
    verifiedAt: "2026-10-28",
    matches: (_args, model) => model === "wan/2-7-image",
    credits: perImage(4.8),
  },
  {
    toolName: "z_image",
    scope: "text-to-image",
    name: "Qwen z-image",
    sourceUrl: "https://kie.ai/pricing",
    sourceFingerprint: "kie-pricing-2026-10-28:z-image:0.8-per-image",
    verifiedAt: "2026-10-28",
    matches: (_args, model) => model === "z-image",
    credits: () => 0.8,
  },
  {
    toolName: "recraft_remove_background",
    scope: "background-removal",
    name: "Recraft Remove Background",
    sourceUrl: "https://kie.ai/pricing",
    sourceFingerprint:
      "kie-pricing-2026-10-28:recraft-remove-background:1-per-image",
    verifiedAt: "2026-10-28",
    matches: (_args, model) => model === "recraft-remove-background",
    credits: () => 1,
  },
  seedanceEntry("text-to-video"),
  seedanceEntry("image-to-video"),
  seedanceEntry("reference-to-video"),
];

export function priceRequest(
  toolName: string,
  args: Record<string, unknown>,
  model: string,
  mode: string,
): PriceState {
  const entry = RATE_CARD.find(
    (candidate) =>
      candidate.toolName === toolName && candidate.matches(args, model, mode),
  );
  if (!entry) return { status: "unknown", rateCardVersion: RATE_CARD_VERSION };
  const credits = entry.credits(args);
  if (credits === undefined)
    return { status: "unknown", rateCardVersion: RATE_CARD_VERSION };
  return {
    status: "exact",
    credits,
    sourceUrl: entry.sourceUrl,
    sourceFingerprint: entry.sourceFingerprint,
    verifiedAt: entry.verifiedAt,
    rateCardVersion: RATE_CARD_VERSION,
  };
}

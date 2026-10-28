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

export const RATE_CARD_VERSION = "2026-10-27";

const GPT_IMAGE_CREDITS: Record<string, number> = {
  "1K": 6,
  "2K": 10,
  "4K": 16,
};

function isGptImageResolution(value: unknown): boolean {
  return typeof value === "string" && value in GPT_IMAGE_CREDITS;
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

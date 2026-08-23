import { MODEL_CATALOG } from "../model-catalog.js";
import { TOOL_REGISTRY } from "../tools/index.js";
import { RATE_CARD } from "./rate-card.js";

const CAPABILITY_SCOPES: Record<string, string> = {
  "image generation": "text-to-image",
  "image editing": "image-to-image",
  "image to image": "image-to-image",
  "image upscale": "upscale",
  "image reframe": "reframe",
  "background removal": "background-removal",
  "text to video": "text-to-video",
  "image to video": "image-to-video",
  "reference to video": "reference-to-video",
  "multi shot": "multi-shot",
  audio: "audio",
  character: "character",
  voice: "audio",
  "video editing": "video-edit",
  "character animation": "animation",
  "character replacement": "character-replacement",
  "lip sync": "lip-sync",
  "talking avatar": "talking-avatar",
  "text to speech": "text-to-speech",
  "sound effects": "sound-effects",
  "music generation": "music-generation",
};

interface PricingScope {
  toolName: string;
  mode: string;
  capability: string;
}

function eligibleScopes(): PricingScope[] {
  const registeredTools = new Set(
    TOOL_REGISTRY.filter((tool) => tool.category !== "utility").map(
      (tool) => tool.name,
    ),
  );
  return MODEL_CATALOG.flatMap((entry) =>
    entry.capabilities.map((capability) => ({
      toolName: entry.toolName,
      mode: CAPABILITY_SCOPES[capability] ?? `unsupported:${capability}`,
      capability,
    })),
  )
    .filter((scope) => registeredTools.has(scope.toolName))
    .filter(
      (scope, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.toolName === scope.toolName &&
            candidate.capability === scope.capability,
        ) === index,
    )
    .sort((left, right) =>
      `${left.toolName}:${left.capability}`.localeCompare(
        `${right.toolName}:${right.capability}`,
      ),
    );
}

/** Reports exact-formula availability by provider route, never as whole-tool coverage. */
export function buildPricingAudit(now = new Date()): Record<string, unknown> {
  const staleAfter = new Date(now);
  staleAfter.setDate(staleAfter.getDate() - 90);
  const scopes = eligibleScopes();
  const formulaSupportedScopes = scopes.flatMap((scope) =>
    RATE_CARD.filter(
      (entry) =>
        entry.toolName === scope.toolName && entry.scope === scope.mode,
    ).map((entry) => ({
      ...scope,
      formula: entry.name,
      sourceUrl: entry.sourceUrl,
      verifiedAt: entry.verifiedAt,
    })),
  );
  const formulaScopeKeys = new Set(
    formulaSupportedScopes.map((scope) => `${scope.toolName}:${scope.mode}`),
  );
  const unknownScopes = scopes.filter(
    (scope) => !formulaScopeKeys.has(`${scope.toolName}:${scope.mode}`),
  );
  const partiallyCoveredTools = [
    ...new Set(formulaSupportedScopes.map((scope) => scope.toolName)),
  ].sort();
  const stale = RATE_CARD.filter(
    (entry) =>
      Number.isNaN(Date.parse(entry.verifiedAt)) ||
      new Date(entry.verifiedAt) < staleAfter,
  ).map((entry) => ({
    toolName: entry.toolName,
    scope: entry.scope,
    verifiedAt: entry.verifiedAt,
    sourceUrl: entry.sourceUrl,
  }));

  return {
    generatedAt: now.toISOString(),
    readOnly: true,
    coverage: {
      eligibleScopes: scopes.length,
      formulaSupportedScopes,
      unknownScopes,
      partiallyCoveredTools,
      fullyCoveredTools: [],
    },
    stale,
  };
}

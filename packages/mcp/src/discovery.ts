import type {
  DiscoverResult,
  ServerCapabilities,
} from "@modelcontextprotocol/server";
import { SUPPORTED_PROTOCOL_VERSIONS } from "@modelcontextprotocol/server";
import { z } from "zod";
import { UPLOAD_WIDGET_MIME } from "./upload-widget.js";

/**
 * Server-side protocol-modern conveniences: the `server/discover` payload,
 * per-tool output schemas, and the MCP Apps extension declaration shared by
 * the constructor capabilities and the discovery response.
 */
export const APPS_EXTENSION_NAME = "io.modelcontextprotocol/ui";

export const appsExtensions: ServerCapabilities["extensions"] = {
  [APPS_EXTENSION_NAME]: { mimeTypes: [UPLOAD_WIDGET_MIME] },
};

export function buildDiscoverPayload(instructions: string): DiscoverResult {
  return {
    supportedVersions: SUPPORTED_PROTOCOL_VERSIONS,
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
      extensions: appsExtensions,
    },
    instructions,
  };
}

// TASK_OUTPUT_SCHEMA covers generation tools whose success results carry
// `structuredContent` through the transport normalization seam
// (task_id required; status/api_type/error when present).
const TASK_OUTPUT_SCHEMA = z.toJSONSchema(
  z.object({
    task_id: z.string(),
    status: z.string().optional(),
    api_type: z.string().optional(),
    error: z.string().optional(),
  }),
);

const UPLOAD_OUTPUT_SCHEMA = z.toJSONSchema(z.object({ media_id: z.string() }));

const USD_CONVERSION = z.object({
  amount: z.number(),
  currency: z.literal("USD"),
  usdPerCredit: z.number(),
  basis: z.string(),
  sourceUrl: z.string(),
});

// Mirrors PreparedGenerationPlan in packages/core/src/generation-plan.ts.
// The output-schema integration test fails when the two drift apart.
const PLAN = z.object({
  id: z.string(),
  createdAt: z.string(),
  expiresAt: z.string(),
  defaultProfile: z.string(),
  maxConcurrency: z.number(),
  items: z.array(
    z.object({
      index: z.number(),
      tool: z.string(),
      model: z.string(),
      mode: z.string(),
      outputCount: z.number(),
      userSettings: z.record(z.string(), z.unknown()),
      appliedDefaults: z.record(z.string(), z.unknown()),
      effectiveSettings: z.record(z.string(), z.unknown()),
      price: z.object({
        status: z.enum(["exact", "estimated", "unknown"]),
        credits: z.number().optional(),
        usd: USD_CONVERSION.optional(),
        sourceUrl: z.string().optional(),
        sourceFingerprint: z.string().optional(),
        verifiedAt: z.string().optional(),
        rateCardVersion: z.string(),
      }),
    }),
  ),
  total: z.object({
    status: z.enum(["exact", "unknown"]),
    credits: z.number().optional(),
    usd: USD_CONVERSION.optional(),
  }),
  requestHash: z.string(),
});

const PREPARE_OUTPUT_SCHEMA = z.toJSONSchema(
  z.object({
    plan_id: z.string(),
    status: z.enum(["prepared", "approved"]),
    approved: z.boolean(),
    input_required: z.boolean().optional(),
    plan: PLAN,
  }),
);

const FINALIZE_OUTPUT_SCHEMA = z.toJSONSchema(
  z.object({
    download_url: z.string(),
    filename: z.string(),
    content_type: z.string(),
    size: z.number(),
  }),
);

const SUBMIT_OUTPUT_SCHEMA = z.toJSONSchema(
  z.object({
    plan_id: z.string(),
    request_hash: z.string(),
    results: z.array(
      z.object({
        index: z.number(),
        tool: z.string(),
        taskId: z.string().optional(),
        error: z.string().optional(),
        result: z.unknown().optional(),
      }),
    ),
  }),
);

const TASK_BEARING_CATEGORIES = new Set(["image", "video", "audio"]);

/** Output schema for a tool, when its structured content is guaranteed. */
export function toolOutputSchema(tool: {
  name: string;
  category: string;
}): Record<string, unknown> | undefined {
  if (tool.name === "prepare_media_generation") return PREPARE_OUTPUT_SCHEMA;
  if (tool.name === "get_upload_url") return UPLOAD_OUTPUT_SCHEMA;
  if (tool.name === "finalize_upload") return FINALIZE_OUTPUT_SCHEMA;
  if (tool.name === "submit_media_generation") return SUBMIT_OUTPUT_SCHEMA;
  if (TASK_BEARING_CATEGORIES.has(tool.category)) return TASK_OUTPUT_SCHEMA;
  return undefined;
}

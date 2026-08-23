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

const PREPARE_OUTPUT_SCHEMA = z.toJSONSchema(
  z.object({
    plan_id: z.string(),
    status: z.enum(["prepared", "approved"]),
    approved: z.boolean(),
    input_required: z.boolean().optional(),
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
  if (TASK_BEARING_CATEGORIES.has(tool.category)) return TASK_OUTPUT_SCHEMA;
  return undefined;
}

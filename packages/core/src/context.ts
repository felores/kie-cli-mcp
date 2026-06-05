import { KieAiClient } from "./kie-ai-client.js";
import { TaskDatabase } from "./database.js";
import { formatToolError } from "./tools/format-error.js";
import type { ToolContext } from "./tools/types.js";
import type { KieAiConfig } from "./types.js";

/** Reads the shared Kie.ai config from environment variables. */
export function configFromEnv(): KieAiConfig {
  return {
    apiKey: process.env.KIE_AI_API_KEY || "",
    baseUrl: process.env.KIE_AI_BASE_URL || "https://api.kie.ai/api/v1",
    timeout: parseInt(process.env.KIE_AI_TIMEOUT || "60000"),
    callbackUrlFallback:
      process.env.KIE_AI_CALLBACK_URL_FALLBACK ||
      "https://proxy.kie.ai/mcp-callback",
  };
}

/**
 * Build a ToolContext from the environment. Used by the CLI (and available to
 * any other adapter) so client, database and helpers are wired identically to
 * the MCP server. Throws if KIE_AI_API_KEY is missing.
 */
export function createToolContext(): ToolContext {
  const config = configFromEnv();
  if (!config.apiKey) {
    throw new Error("KIE_AI_API_KEY environment variable is required");
  }
  const client = new KieAiClient(config);
  const db = new TaskDatabase(process.env.KIE_AI_DB_PATH);

  return {
    client,
    db,
    getCallbackUrl: (url) =>
      url || process.env.KIE_AI_CALLBACK_URL || config.callbackUrlFallback,
    formatError: formatToolError,
  };
}

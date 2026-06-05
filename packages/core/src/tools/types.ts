import { z } from "zod";
import type { KieAiClient } from "../kie-ai-client.js";
import type { TaskDatabase } from "../database.js";

/**
 * Transport-agnostic result of running a tool. It is the MCP CallTool content
 * envelope: the text is JSON. The MCP adapter returns it verbatim; the CLI
 * unwraps `content[0].text` (JSON.parse) to print pretty or raw. Keeping the
 * envelope here means the tool bodies are copied from the original handlers
 * unchanged, so MCP responses stay byte-identical.
 */
export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
  [key: string]: unknown;
}

/**
 * Everything a tool's `run` needs at execution time. Built once per process by
 * each adapter (MCP server or CLI) and passed into every tool. This is the seam
 * that lets the exact same tool logic run under either transport.
 */
export interface ToolContext {
  client: KieAiClient;
  db: TaskDatabase;
  /** Resolves the callback URL using env fallbacks (mirrors the MCP behaviour). */
  getCallbackUrl(url?: string): string;
  /** Builds the structured error envelope with per-parameter guidance. */
  formatError(
    toolName: string,
    error: unknown,
    paramDescriptions: Record<string, string>,
  ): ToolResult;
  /**
   * Optional progress sink for long-running tools. The MCP adapter wires this to
   * `notifications/progress` when the client opted in with a `progressToken`,
   * which keeps the open `tools/call` request alive (clients reset their timeout
   * on each notification). The CLI leaves it undefined, so tools must treat it as
   * a best-effort no-op (`ctx.onProgress?.(...)`).
   */
  onProgress?(update: {
    progress: number;
    total?: number;
    message?: string;
  }): Promise<void>;
}

export type ToolCategory = "image" | "video" | "audio" | "utility";

/**
 * Single source of truth for one tool. Add a model = add one ToolDef. Both the
 * MCP `listTools`/`callTool` and the CLI command tree are derived from these.
 */
export interface ToolDef<S extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  category: ToolCategory;
  /** The only schema definition for this tool. MCP inputSchema is derived from it. */
  schema: S;
  /** Returns the MCP content envelope. Validation/business logic lives here. */
  run(args: z.infer<S>, ctx: ToolContext): Promise<ToolResult>;
}

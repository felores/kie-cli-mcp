import type { z } from "zod";
import type { TaskDatabase } from "../database.js";
import type { PreparedGenerationPlan } from "../generation-plan.js";
import type { KieAiClient } from "../kie-ai-client.js";

/**
 * Transport-agnostic result of running a tool. It is the MCP CallTool content
 * envelope: the text is JSON. The MCP adapter returns it verbatim; the CLI
 * unwraps `content[0].text` (JSON.parse) to print pretty or raw. Keeping the
 * envelope here means the tool bodies are copied from the original handlers
 * unchanged, so MCP responses stay byte-identical.
 */
export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
  isError?: boolean;
  [key: string]: unknown;
}

export interface PlanApprovalDecision {
  approved: boolean;
  reason: string;
  /**
   * Modern-protocol hosts must be asked for input through a multi-round-trip
   * `input_required` result. When true, the adapter converts the tool result
   * into an input-required return instead of surfacing the pending text.
   */
  inputRequired?: boolean;
}

export interface UploadCapabilityRequest {
  filename: string;
  contentType: string;
  size: number;
  owner: string;
}

export interface UploadCapability {
  uploadUrl: string;
  mediaId: string;
  uploadExpiresAt: string;
}

export interface FinalizedUpload {
  downloadUrl: string;
  filename: string;
  contentType: string;
  size: number;
}

export interface LocalUpload {
  bytes: Uint8Array;
  filename: string;
  contentType: string;
}

/**
 * Everything a tool's `run` needs at execution time. Built once per process by
 * each adapter (MCP server or CLI) and passed into every tool. This is the seam
 * that lets the exact same tool logic run under either transport.
 */
export interface ToolContext {
  client: KieAiClient;
  db: TaskDatabase;
  /** Opaque adapter-owned identity that binds a media plan to its caller. */
  approvalContext: string;
  /** Resolves the callback URL using env fallbacks (mirrors the MCP behaviour). */
  getCallbackUrl(url?: string): string;
  /** Builds the structured error envelope with per-parameter guidance. */
  formatError(
    toolName: string,
    error: unknown,
    paramDescriptions: Record<string, string>,
  ): ToolResult;
  /** Resolves a tool available to this adapter for approval-bound plan execution. */
  getTool(name: string): ToolDef | undefined;
  /** Adapter-owned HTTP capability minting. Unavailable in stdio and CLI. */
  createUploadCapability?(
    request: UploadCapabilityRequest,
  ): Promise<UploadCapability>;
  finalizeUpload?(request: {
    mediaId: string;
    owner: string;
  }): Promise<FinalizedUpload>;
  readLocalUpload?(path: string, maxBytes: number): Promise<LocalUpload>;
  createWidgetGrant?(): string;
  validateWidgetGrant?(grant: string): boolean;
  /** Public origin allowlisted in the MCP Apps resource CSP. */
  getUploadPublicOrigin?(): string | undefined;
  /** Requests transport-specific approval for a persisted generation plan. */
  requestPlanApproval?(
    plan: PreparedGenerationPlan,
  ): Promise<PlanApprovalDecision>;
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
  /** Optional MCP Apps presentation metadata. Other adapters ignore it. */
  ui?: {
    resourceUri?: string;
    visibility?: Array<"model" | "app">;
  };
  /** Returns the MCP content envelope. Validation/business logic lives here. */
  run(args: z.infer<S>, ctx: ToolContext): Promise<ToolResult>;
}

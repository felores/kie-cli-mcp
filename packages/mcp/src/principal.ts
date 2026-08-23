import { createHash } from "node:crypto";

/**
 * Transport-independent identity of one logical MCP caller. stdio maps to the
 * enclosing process; Streamable HTTP maps to one session. All per-caller state
 * (generation plans, approvals, uploads, widget grants) is owned by the
 * principal rather than by an individual Server instance, so a fresh Server
 * created for a later request of the same principal resolves the same state.
 * This is the prerequisite for the stateless (SDK v2) request model.
 */
export type CallerPrincipal = string;

/** Principal of the single stdio caller. */
export const STDIO_PRINCIPAL: CallerPrincipal = "stdio";

const MAX_PRINCIPAL_LENGTH = 512;

export function isUsablePrincipal(value: string): boolean {
  return value.length > 0 && value.length <= MAX_PRINCIPAL_LENGTH;
}

/**
 * Opaque, deterministic owner id derived from a principal. Serves as
 * `ToolContext.approvalContext` so plans, approvals, uploads and widget grants
 * created under one Server instance stay addressable from another instance of
 * the same principal. Hashing keeps the raw transport identity out of owner
 * columns and logs.
 */
export function principalApprovalId(principal: CallerPrincipal): string {
  return createHash("sha256")
    .update(`mcp-principal:${principal}`)
    .digest("hex");
}

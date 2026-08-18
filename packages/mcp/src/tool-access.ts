import type { ToolDef } from "@felores/kie-ai-core";

/** Direct provider calls are an explicit compatibility opt-in, never the default. */
export function allowsDirectGeneration(): boolean {
  return process.env.KIE_AI_ALLOW_DIRECT_GENERATION === "true";
}

/**
 * MCP exposes utilities normally, but paid generation categories must use the
 * prepare -> host approval -> submit workflow unless explicitly opted in.
 */
export function isMcpToolCallable(
  tool: ToolDef,
  enabledTools: ReadonlySet<string>,
  allowDirectGeneration = allowsDirectGeneration(),
): boolean {
  return (
    enabledTools.has(tool.name) &&
    (tool.category === "utility" || allowDirectGeneration)
  );
}

import type { ToolResult } from "@felores/kie-ai-core";

// SDK v2 clients prefer structured results over parsing presentation text. A
// tool result whose text envelope reports a provider task id exposes it (plus
// status, api_type and error when present) as structuredContent, unless the
// tool already returned a richer structured result. Pure presentation
// normalization: the text, `_meta`, and `isError` are never changed.
export function normalizeToolResult(result: ToolResult): ToolResult {
  if (result.structuredContent !== undefined) return result;
  const text = result.content[0]?.text;
  if (!text) return result;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return result;
  }
  if (typeof parsed !== "object" || parsed === null) return result;
  const record = parsed as Record<string, unknown>;
  if (typeof record.task_id !== "string") return result;
  const structuredContent: Record<string, unknown> = {
    task_id: record.task_id,
  };
  for (const key of ["status", "api_type", "error"] as const) {
    if (typeof record[key] === "string") {
      structuredContent[key] = record[key];
    }
  }
  return { ...result, structuredContent };
}

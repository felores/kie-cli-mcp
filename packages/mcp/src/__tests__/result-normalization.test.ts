import type { ToolResult } from "@felores/kie-ai-core";
import { describe, expect, test } from "@jest/globals";
import { normalizeToolResult } from "../result-normalization.js";

function textResult(
  payload: unknown,
  extra: Partial<ToolResult> = {},
): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload) }],
    ...extra,
  };
}

describe("normalizeToolResult", () => {
  test("exposes task_id, status, api_type and error from the text envelope", () => {
    const result = normalizeToolResult(
      textResult({
        success: true,
        task_id: "veo-123",
        status: "pending",
        api_type: "veo3",
      }),
    );
    expect(result.structuredContent).toEqual({
      task_id: "veo-123",
      status: "pending",
      api_type: "veo3",
    });
  });

  test("leaves richer structured results untouched", () => {
    const original = textResult(
      { task_id: "x" },
      {
        structuredContent: { media_id: "m-1" },
      },
    );
    expect(normalizeToolResult(original)).toBe(original);
  });

  test("leaves non-task results untouched", () => {
    const original = textResult({ success: true, count: 3 });
    expect(normalizeToolResult(original)).toBe(original);
  });

  test("leaves non-JSON text untouched", () => {
    const original: ToolResult = {
      content: [{ type: "text", text: "plain prose" }],
    };
    expect(normalizeToolResult(original)).toBe(original);
  });

  test("never mutates isError or text", () => {
    const original = textResult(
      { success: false, task_id: "t", error: "boom" },
      { isError: true },
    );
    const result = normalizeToolResult(original);
    expect(result.isError).toBe(true);
    expect(result.content).toBe(original.content);
    expect(result.structuredContent).toMatchObject({
      task_id: "t",
      error: "boom",
    });
  });
});

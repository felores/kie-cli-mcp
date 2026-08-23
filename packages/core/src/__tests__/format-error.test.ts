import { describe, expect, test } from "@jest/globals";
import { formatToolError } from "../tools/format-error.js";

describe("formatToolError", () => {
  test("marks the envelope as an error result with structured content", () => {
    const result = formatToolError(
      "nano_banana_image",
      new Error("provider said no"),
      { prompt: "Required" },
    );
    expect(result.isError).toBe(true);
    expect(result.content[0].type).toBe("text");
    const text = JSON.parse(result.content[0].text) as {
      success: boolean;
      tool: string;
      error: string;
    };
    expect(text).toMatchObject({
      success: false,
      tool: "nano_banana_image",
      error: "provider said no",
    });
    expect(result.structuredContent).toMatchObject({
      success: false,
      tool: "nano_banana_image",
      error: "provider said no",
    });
  });

  test("keeps tool text and structured content in sync", () => {
    const result = formatToolError("list_tasks", new SyntaxError("boom"), {});
    expect(result.structuredContent?.error).toBe("boom");
    expect(result.content[0].text).toContain("boom");
  });
});

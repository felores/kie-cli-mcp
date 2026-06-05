import type { ToolResult } from "./types.js";

/**
 * Build the structured error envelope with per-parameter guidance. Identical
 * logic to the original MCP handler error formatting, shared so the CLI and the
 * MCP server report failures the same way.
 */
export function formatToolError(
  toolName: string,
  error: unknown,
  paramDescriptions: Record<string, string>,
): ToolResult {
  let errorMessage = "Unknown error";
  let errorDetails = "";

  if (error instanceof Error) {
    errorMessage = error.message;

    if (errorMessage.includes("ZodError")) {
      const lines = errorMessage.split("\n");
      const validationErrors = lines.filter(
        (line) =>
          line.includes("Expected") ||
          line.includes("Required") ||
          line.includes("Invalid"),
      );

      if (validationErrors.length > 0) {
        errorDetails = `Validation errors:\n${validationErrors
          .map((err) => `- ${err.trim()}`)
          .join("\n")}`;
      }
    }
  }

  const paramGuidance = Object.entries(paramDescriptions)
    .map(([param, desc]) => `- ${param}: ${desc}`)
    .join("\n");

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            success: false,
            tool: toolName,
            error: errorMessage,
            details: errorDetails,
            parameter_guidance: paramGuidance,
            message: `Failed to execute ${toolName}. Check parameters and try again.`,
          },
          null,
          2,
        ),
      },
    ],
  };
}

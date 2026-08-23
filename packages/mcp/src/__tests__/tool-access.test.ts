import { TOOL_REGISTRY } from "@felores/kie-ai-core";
import { describe, expect, test } from "@jest/globals";
import { allowsDirectGeneration, isMcpToolCallable } from "../tool-access.js";

const enabledTools = new Set(TOOL_REGISTRY.map((tool) => tool.name));
const generationTools = TOOL_REGISTRY.filter(
  (tool) => tool.category !== "utility",
);
const utilityTool = TOOL_REGISTRY.find((tool) => tool.category === "utility")!;

describe("MCP direct generation access", () => {
  test("does not list or allow direct generation by default while utilities remain callable", () => {
    const listedTools = TOOL_REGISTRY.filter((tool) =>
      isMcpToolCallable(tool, enabledTools, false),
    ).map((tool) => tool.name);

    expect(
      generationTools.every((tool) => !listedTools.includes(tool.name)),
    ).toBe(true);
    expect(
      generationTools.every(
        (tool) => !isMcpToolCallable(tool, enabledTools, false),
      ),
    ).toBe(true);
    expect(listedTools).toContain(utilityTool.name);
    expect(isMcpToolCallable(utilityTool, enabledTools, false)).toBe(true);
  });

  test("allows direct generation only with the explicit compatibility opt-in", () => {
    expect(
      generationTools.every((tool) =>
        isMcpToolCallable(tool, enabledTools, true),
      ),
    ).toBe(true);

    const previous = process.env.KIE_AI_ALLOW_DIRECT_GENERATION;
    try {
      process.env.KIE_AI_ALLOW_DIRECT_GENERATION = "true";
      expect(allowsDirectGeneration()).toBe(true);
      process.env.KIE_AI_ALLOW_DIRECT_GENERATION = "1";
      expect(allowsDirectGeneration()).toBe(false);
    } finally {
      if (previous === undefined)
        delete process.env.KIE_AI_ALLOW_DIRECT_GENERATION;
      else process.env.KIE_AI_ALLOW_DIRECT_GENERATION = previous;
    }
  });
});

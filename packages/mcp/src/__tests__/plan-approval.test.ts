import type { PreparedGenerationPlan } from "@felores/kie-ai-core";
import { describe, expect, jest, test } from "@jest/globals";
import type { Server } from "@modelcontextprotocol/server";
import { requestMcpPlanApproval } from "../plan-approval.js";

const plan: PreparedGenerationPlan = {
  id: "11111111-1111-4111-8111-111111111111",
  createdAt: "2026-08-17T00:00:00.000Z",
  expiresAt: "2026-08-17T00:15:00.000Z",
  defaultProfile: "safe",
  maxConcurrency: 1,
  items: [
    {
      index: 0,
      tool: "nano_banana_image",
      model: "nano-banana-2-lite",
      mode: "text-to-image",
      outputCount: 1,
      userSettings: { prompt: "A red panda" },
      appliedDefaults: { model: "nano-banana-2-lite", resolution: "1K" },
      effectiveSettings: {
        prompt: "A red panda",
        model: "nano-banana-2-lite",
        resolution: "1K",
      },
      price: {
        status: "exact",
        credits: 4,
        rateCardVersion: "2026-08-17",
        verifiedAt: "2026-08-17",
        sourceUrl: "https://example.com",
        sourceFingerprint: "test",
      },
    },
  ],
  total: { status: "exact", credits: 4 },
  requestHash: "hash",
};

describe("MCP media-plan approval", () => {
  test("requires accepted form confirmation", async () => {
    const elicitInput = jest.fn(async () => ({
      action: "accept" as const,
      content: { confirm: true },
    }));
    const server = {
      getClientCapabilities: () => ({ elicitation: { form: {} } }),
      elicitInput,
    } as unknown as Pick<Server, "getClientCapabilities" | "elicitInput">;

    await expect(requestMcpPlanApproval(server, plan)).resolves.toEqual({
      approved: true,
      reason: "Host confirmed the plan.",
    });
    expect(elicitInput).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "form",
        requestedSchema: expect.objectContaining({ required: ["confirm"] }),
        message: expect.stringContaining("4 credits total"),
      }),
    );
  });

  test("supports legacy empty elicitation capabilities as form-capable", async () => {
    const elicitInput = jest.fn(async () => ({
      action: "accept" as const,
      content: { confirm: true },
    }));
    const server = {
      getClientCapabilities: () => ({ elicitation: {} }),
      elicitInput,
    } as unknown as Pick<Server, "getClientCapabilities" | "elicitInput">;

    await expect(requestMcpPlanApproval(server, plan)).resolves.toEqual({
      approved: true,
      reason: "Host confirmed the plan.",
    });
    expect(elicitInput).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "form" }),
    );
  });

  test("decline and unsupported elicitation never approve", async () => {
    const declined = {
      getClientCapabilities: () => ({ elicitation: { form: {} } }),
      elicitInput: jest.fn(async () => ({ action: "decline" as const })),
    } as unknown as Pick<Server, "getClientCapabilities" | "elicitInput">;
    const unsupported = {
      getClientCapabilities: () => ({}),
      elicitInput: jest.fn(),
    } as unknown as Pick<Server, "getClientCapabilities" | "elicitInput">;

    await expect(requestMcpPlanApproval(declined, plan)).resolves.toMatchObject(
      { approved: false },
    );
    await expect(
      requestMcpPlanApproval(unsupported, plan),
    ).resolves.toMatchObject({
      approved: false,
      reason: expect.stringContaining("does not support"),
    });
    expect(unsupported.elicitInput).not.toHaveBeenCalled();
  });
});

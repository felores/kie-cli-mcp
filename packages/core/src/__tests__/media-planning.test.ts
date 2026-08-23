import { jest } from "@jest/globals";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { TaskDatabase } from "../database.js";
import { prepareGenerationPlan } from "../generation-plan.js";
import { filterCatalog } from "../model-catalog.js";
import { buildPricingAudit } from "../pricing/audit.js";
import { priceRequest, RATE_CARD } from "../pricing/rate-card.js";
import { getTaskStatusTool } from "../tools/get_task_status.js";
import { hailuoVideoTool } from "../tools/hailuo_video.js";
import { getTool } from "../tools/index.js";
import { nanoBananaImageTool } from "../tools/nano_banana_image.js";
import { prepareMediaGenerationTool } from "../tools/prepare_media_generation.js";
import { submitMediaGenerationTool } from "../tools/submit_media_generation.js";
import type { ToolContext, ToolDef } from "../tools/types.js";

function readResult(result: {
  content: Array<{ text: string }>;
}): Record<string, unknown> {
  return JSON.parse(result.content[0].text) as Record<string, unknown>;
}

function testDatabase(): { db: TaskDatabase; cleanup: () => Promise<void> } {
  const directory = mkdtempSync(join(tmpdir(), "kie-media-plan-"));
  const db = new TaskDatabase(join(directory, "tasks.db"));
  return {
    db,
    cleanup: async () => {
      await db.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

function context(
  db: TaskDatabase,
  client: Record<string, unknown> = {},
  availableTool = getTool,
  requestPlanApproval?: ToolContext["requestPlanApproval"],
  approvalContext = "test",
): ToolContext {
  return {
    db,
    client: client as unknown as ToolContext["client"],
    approvalContext,
    getCallbackUrl: (url) => url ?? "https://callback.example/complete",
    getTool: availableTool,
    ...(requestPlanApproval ? { requestPlanApproval } : {}),
    formatError: (_tool, error) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      ],
    }),
  };
}

describe("media planning", () => {
  test("applies safe defaults without overwriting explicit settings and resolves the plan", () => {
    const plan = prepareGenerationPlan(
      [
        {
          tool: "nano_banana_image",
          args: {
            prompt: "A mountain",
            model: "nano-banana-2",
            resolution: "2K",
          },
        },
      ],
      new Map([["nano_banana_image", nanoBananaImageTool]]),
    );
    const item = plan.items[0];
    expect(item.model).toBe("nano-banana-2");
    expect(item.mode).toBe("text-to-image");
    expect(item.outputCount).toBe(1);
    expect(item.userSettings).toMatchObject({
      model: "nano-banana-2",
      resolution: "2K",
    });
    expect(item.effectiveSettings).toMatchObject({
      model: "nano-banana-2",
      resolution: "2K",
    });
    expect(item.appliedDefaults).not.toHaveProperty("model");
    expect(item.appliedDefaults).not.toHaveProperty("resolution");
    expect(item.price).toEqual(expect.objectContaining({ status: "unknown" }));
  });

  test("validates target schemas during prepare and does not call a provider", async () => {
    const { db, cleanup } = testDatabase();
    const client = { generateNanoBananaImage: jest.fn() };
    try {
      const valid = await prepareMediaGenerationTool.run(
        {
          items: [{ tool: "nano_banana_image", args: { prompt: "A fox" } }],
        },
        context(db, client),
      );
      expect(readResult(valid)).toMatchObject({ success: true });
      expect(client.generateNanoBananaImage).not.toHaveBeenCalled();

      const invalid = await prepareMediaGenerationTool.run(
        {
          items: [
            {
              tool: "hailuo_video",
              args: {
                prompt: "Invalid",
                duration: 5,
                aspectRatio: "16:9",
                unexpected: true,
              },
            },
          ],
        },
        context(db, client),
      );
      expect(readResult(invalid)).toMatchObject({ success: false });
      expect(client.generateNanoBananaImage).not.toHaveBeenCalled();
    } finally {
      await cleanup();
    }
  });

  test("rejects unavailable tools both while preparing and before claiming a plan", async () => {
    const { db, cleanup } = testDatabase();
    const client = { generateNanoBananaImage: jest.fn() };
    try {
      const unavailable = () => undefined;
      const prepared = await prepareMediaGenerationTool.run(
        {
          items: [{ tool: "nano_banana_image", args: { prompt: "Blocked" } }],
        },
        context(db, client, unavailable),
      );
      expect(readResult(prepared)).toMatchObject({
        success: false,
        error: expect.stringContaining("Unsupported generation tool"),
      });

      const plan = prepareGenerationPlan(
        [
          {
            tool: "nano_banana_image",
            args: { prompt: "Previously prepared" },
          },
        ],
        new Map([["nano_banana_image", nanoBananaImageTool]]),
      );
      await db.createGenerationPlan(plan, "test");
      await db.approveGenerationPlan(plan.id, plan.requestHash, "test");
      const submitted = await submitMediaGenerationTool.run(
        { planId: plan.id },
        context(db, client, unavailable),
      );
      expect(readResult(submitted)).toMatchObject({
        success: false,
        error: expect.stringContaining("unavailable tool"),
      });
      expect((await db.getGenerationPlan(plan.id))?.status).toBe("approved");
      expect(client.generateNanoBananaImage).not.toHaveBeenCalled();
    } finally {
      await cleanup();
    }
  });

  test("applies the MiniMax H3 duration default to every mode and aspect ratio only to text-to-video", () => {
    const tools = new Map([["hailuo_video", hailuoVideoTool]]);
    const textPlan = prepareGenerationPlan(
      [{ tool: "hailuo_video", args: { prompt: "A fox" } }],
      tools,
    );
    const imagePlan = prepareGenerationPlan(
      [
        {
          tool: "hailuo_video",
          args: { prompt: "A fox", imageUrl: "https://example.com/start.png" },
        },
      ],
      tools,
    );
    const referencePlan = prepareGenerationPlan(
      [
        {
          tool: "hailuo_video",
          args: {
            prompt: "A fox",
            referenceImageUrls: ["https://example.com/reference.png"],
          },
        },
      ],
      tools,
    );
    const adaptiveReferencePlan = prepareGenerationPlan(
      [
        {
          tool: "hailuo_video",
          args: {
            prompt: "A fox",
            duration: 5,
            referenceImageUrls: ["https://example.com/reference.png"],
            aspectRatio: "adaptive",
          },
        },
      ],
      tools,
    );

    expect(textPlan.items[0]).toMatchObject({
      mode: "text-to-video",
      effectiveSettings: { duration: 5, aspectRatio: "16:9" },
    });
    expect(imagePlan.items[0]).toMatchObject({
      mode: "image-to-video",
      effectiveSettings: { duration: 5 },
    });
    expect(imagePlan.items[0].effectiveSettings).not.toHaveProperty(
      "aspectRatio",
    );
    expect(referencePlan.items[0]).toMatchObject({
      mode: "reference-to-video",
      effectiveSettings: { duration: 5 },
    });
    expect(referencePlan.items[0].effectiveSettings).not.toHaveProperty(
      "aspectRatio",
    );
    expect(adaptiveReferencePlan.items[0]).toMatchObject({
      mode: "reference-to-video",
      effectiveSettings: { aspectRatio: "adaptive" },
    });
  });

  test("records accepted MCP approval and leaves declined or unsupported plans prepared", async () => {
    const { db, cleanup } = testDatabase();
    const client = { generateNanoBananaImage: jest.fn() };
    try {
      const acceptedApproval = jest.fn(async () => ({
        approved: true,
        reason: "Host confirmed the plan.",
      }));
      const accepted = await prepareMediaGenerationTool.run(
        {
          items: [
            { tool: "nano_banana_image", args: { prompt: "Approval check" } },
          ],
        },
        context(db, client, getTool, acceptedApproval),
      );
      const acceptedResult = readResult(accepted);
      const acceptedPlanId = String(acceptedResult.planId);
      expect(acceptedResult).toMatchObject({
        success: true,
        approved: true,
        status: "approved",
      });
      expect(acceptedApproval).toHaveBeenCalledTimes(1);
      expect((await db.getGenerationPlan(acceptedPlanId))?.status).toBe(
        "approved",
      );

      const declined = await prepareMediaGenerationTool.run(
        {
          items: [{ tool: "nano_banana_image", args: { prompt: "Declined" } }],
        },
        context(db, client, getTool, async () => ({
          approved: false,
          reason: "Host declined the approval request.",
        })),
      );
      const declinedPlanId = String(readResult(declined).planId);
      expect(readResult(declined)).toMatchObject({
        approved: false,
        status: "prepared",
        reason: expect.stringContaining("declined"),
      });
      expect((await db.getGenerationPlan(declinedPlanId))?.status).toBe(
        "prepared",
      );

      const unsupported = await prepareMediaGenerationTool.run(
        {
          items: [
            { tool: "nano_banana_image", args: { prompt: "Unsupported" } },
          ],
        },
        context(db, client),
      );
      const unsupportedPlanId = String(readResult(unsupported).planId);
      expect(readResult(unsupported)).toMatchObject({
        approved: false,
        status: "prepared",
        reason: expect.stringContaining("cannot request approval"),
      });
      expect((await db.getGenerationPlan(unsupportedPlanId))?.status).toBe(
        "prepared",
      );

      const submitted = await submitMediaGenerationTool.run(
        { planId: declinedPlanId },
        context(db, client),
      );
      expect(readResult(submitted)).toMatchObject({
        success: false,
        error: expect.stringContaining("not approved"),
      });
      expect(client.generateNanoBananaImage).not.toHaveBeenCalled();
    } finally {
      await cleanup();
    }
  });

  test("binds approval and submission to the caller approval context", async () => {
    const { db, cleanup } = testDatabase();
    const client = { generateNanoBananaImage: jest.fn() };
    try {
      const prepared = await prepareMediaGenerationTool.run(
        {
          items: [
            { tool: "nano_banana_image", args: { prompt: "Context check" } },
          ],
        },
        context(db, client, getTool, undefined, "owner-context"),
      );
      const planId = String(readResult(prepared).planId);
      const stored = await db.getGenerationPlan(planId);
      expect(stored?.status).toBe("prepared");

      expect(
        await db.approveGenerationPlan(
          planId,
          stored!.requestHash,
          "other-context",
        ),
      ).toBe(false);
      expect(
        await db.approveGenerationPlan(
          planId,
          stored!.requestHash,
          "owner-context",
        ),
      ).toBe(true);

      const crossContextSubmit = await submitMediaGenerationTool.run(
        { planId },
        context(db, client, getTool, undefined, "other-context"),
      );
      expect(readResult(crossContextSubmit)).toMatchObject({
        success: false,
        error: expect.stringContaining("approval context"),
      });
      expect((await db.getGenerationPlan(planId))?.status).toBe("approved");
      expect(client.generateNanoBananaImage).not.toHaveBeenCalled();
    } finally {
      await cleanup();
    }
  });

  test("resolves unified tool modes from provider route selectors, not style or quality fields", () => {
    const tools = new Map(
      [
        "grok_imagine",
        "midjourney_generate",
        "kling_video",
        "wan_video",
        "flux2_image",
      ].map((name) => [name, getTool(name)!] as [string, ToolDef]),
    );
    const plan = prepareGenerationPlan(
      [
        { tool: "grok_imagine", args: { prompt: "A fox", mode: "fun" } },
        {
          tool: "midjourney_generate",
          args: {
            prompt: "A fox",
            fileUrl: "https://example.com/start.png",
            taskType: "mj_video",
            motion: 20,
          },
        },
        { tool: "kling_video", args: { prompt: "A fox", mode: "pro" } },
        {
          tool: "wan_video",
          args: {
            prompt: "A fox",
            mode: "video-edit",
            video_url_edit: "https://example.com/source.mp4",
          },
        },
        {
          tool: "flux2_image",
          args: {
            prompt: "A fox",
            input_urls: ["https://example.com/reference.png"],
          },
        },
      ],
      tools,
    );

    expect(plan.items.map((item) => item.mode)).toEqual([
      "text-to-video",
      "image-to-video",
      "text-to-video",
      "video-edit",
      "image-to-image",
    ]);
  });

  test("returns exact formulas only for verified dimensions and leaves mixed totals unknown", () => {
    const nano = priceRequest(
      "nano_banana_image",
      { outputCount: 1 },
      "nano-banana-2-lite",
      "text-to-image",
    );
    expect(nano).toMatchObject({
      status: "exact",
      credits: 4,
      verifiedAt: "2026-08-17",
    });
    expect(
      priceRequest(
        "nano_banana_image",
        { outputCount: 1 },
        "nano-banana-2-lite",
        "image-to-image",
      ),
    ).toEqual({ status: "unknown", rateCardVersion: "2026-08-17" });
    const hailuo = priceRequest(
      "hailuo_video",
      { duration: 6, resolution: "768p" },
      "minimax-h3",
      "reference-to-video",
    );
    expect(hailuo).toMatchObject({ status: "exact", credits: 96 });
    expect(
      priceRequest(
        "hailuo_video",
        { duration: 6 },
        "minimax-h3",
        "reference-to-video",
      ),
    ).toEqual({ status: "unknown", rateCardVersion: "2026-08-17" });
    expect(
      RATE_CARD.every(
        (entry) =>
          entry.verifiedAt && entry.sourceFingerprint && entry.sourceUrl,
      ),
    ).toBe(true);
    expect(RATE_CARD).toHaveLength(2);

    const plan = prepareGenerationPlan(
      [
        { tool: "nano_banana_image", args: { prompt: "A fox" } },
        {
          tool: "nano_banana_image",
          args: { prompt: "A bear", model: "nano-banana-2" },
        },
      ],
      new Map([["nano_banana_image", nanoBananaImageTool]]),
    );
    expect(plan.items[0].price).toMatchObject({ status: "exact", credits: 4 });
    expect(plan.items[1].price.status).toBe("unknown");
    expect(plan.total).toEqual({ status: "unknown" });
    expect(JSON.stringify(plan)).not.toContain("USD");
  });

  test("audits exact formulas by eligible provider route instead of treating partial tools as covered", () => {
    const audit = buildPricingAudit(new Date("2026-08-17T00:00:00.000Z")) as {
      coverage: {
        formulaSupportedScopes: Array<{ toolName: string; mode: string }>;
        unknownScopes: Array<{
          toolName: string;
          mode: string;
          capability: string;
        }>;
        partiallyCoveredTools: string[];
        fullyCoveredTools: string[];
      };
    };
    expect(audit.coverage.formulaSupportedScopes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          toolName: "nano_banana_image",
          mode: "text-to-image",
        }),
        expect.objectContaining({
          toolName: "hailuo_video",
          mode: "reference-to-video",
        }),
      ]),
    );
    expect(audit.coverage.unknownScopes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          toolName: "hailuo_video",
          mode: "text-to-video",
          capability: "text to video",
        }),
        expect.objectContaining({
          toolName: "hailuo_video",
          mode: "image-to-video",
          capability: "image to video",
        }),
        expect.objectContaining({
          toolName: "nano_banana_image",
          mode: "image-to-image",
          capability: "image editing",
        }),
        expect.objectContaining({
          toolName: "kling_video",
          mode: "multi-shot",
          capability: "multi shot",
        }),
        expect.objectContaining({
          toolName: "gemini_omni",
          mode: "character",
          capability: "character",
        }),
        expect.objectContaining({
          toolName: "gemini_omni",
          mode: "audio",
          capability: "voice",
        }),
      ]),
    );
    expect(audit.coverage.partiallyCoveredTools).toEqual(
      expect.arrayContaining(["hailuo_video", "nano_banana_image"]),
    );
    expect(audit.coverage.fullyCoveredTools).toEqual([]);
  });

  test("submits each item once with a maximum of four concurrent provider creates and rejects replay", async () => {
    const { db, cleanup } = testDatabase();
    let active = 0;
    let maximum = 0;
    let sequence = 0;
    const client = {
      generateNanoBananaImage: jest.fn(async () => {
        active += 1;
        maximum = Math.max(maximum, active);
        await new Promise((resolve) => setTimeout(resolve, 10));
        active -= 1;
        sequence += 1;
        return { code: 200, msg: "ok", data: { taskId: `task-${sequence}` } };
      }),
    };
    try {
      const prepared = await prepareMediaGenerationTool.run(
        {
          items: Array.from({ length: 6 }, (_, index) => ({
            tool: "nano_banana_image",
            args: { prompt: `Image ${index}` },
          })),
        },
        context(db, client),
      );
      const planId = String(readResult(prepared).planId);
      const stored = await db.getGenerationPlan(planId);
      await db.approveGenerationPlan(planId, stored!.requestHash, "test");
      const submitted = await submitMediaGenerationTool.run(
        { planId },
        context(db, client),
      );
      const submission = readResult(submitted);
      expect(submission.success).toBe(true);
      expect(submission.results as unknown[]).toHaveLength(6);
      expect(client.generateNanoBananaImage).toHaveBeenCalledTimes(6);
      expect(maximum).toBeLessThanOrEqual(4);
      expect(
        (submission.results as Array<{ taskId?: string }>).every(
          (result) => result.taskId,
        ),
      ).toBe(true);

      const replay = await submitMediaGenerationTool.run(
        { planId },
        context(db, client),
      );
      expect(readResult(replay)).toMatchObject({ success: false });
      expect(client.generateNanoBananaImage).toHaveBeenCalledTimes(6);
    } finally {
      await cleanup();
    }
  });

  test("fails a claimed plan when a target tool returns a standard error envelope", async () => {
    const { db, cleanup } = testDatabase();
    const failedRun = jest.fn(async () => ({
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            success: false,
            error: "Provider rejected request",
          }),
        },
      ],
    }));
    const failingTool: ToolDef = { ...nanoBananaImageTool, run: failedRun };
    const availableTool = (name: string) =>
      name === "nano_banana_image" ? failingTool : undefined;
    try {
      const plan = prepareGenerationPlan(
        [{ tool: "nano_banana_image", args: { prompt: "Rejected" } }],
        new Map([["nano_banana_image", nanoBananaImageTool]]),
      );
      await db.createGenerationPlan(plan, "test");
      await db.approveGenerationPlan(plan.id, plan.requestHash, "test");

      const submitted = readResult(
        await submitMediaGenerationTool.run(
          { planId: plan.id },
          context(db, {}, availableTool),
        ),
      );
      expect(submitted).toMatchObject({
        success: false,
        error: expect.stringContaining("failed"),
      });
      expect(failedRun).toHaveBeenCalledTimes(1);
      expect(await db.getGenerationPlan(plan.id)).toMatchObject({
        status: "failed",
        results: [
          expect.objectContaining({ error: "Provider rejected request" }),
        ],
      });

      await submitMediaGenerationTool.run(
        { planId: plan.id },
        context(db, {}, availableTool),
      );
      expect(failedRun).toHaveBeenCalledTimes(1);
    } finally {
      await cleanup();
    }
  });

  test("rejects expired and tampered persisted plans before a provider call", async () => {
    const { db, cleanup } = testDatabase();
    const client = { generateNanoBananaImage: jest.fn() };
    try {
      const expired = prepareGenerationPlan(
        [{ tool: "nano_banana_image", args: { prompt: "Expired" } }],
        new Map([["nano_banana_image", nanoBananaImageTool]]),
        { expiresInSeconds: -1 },
      );
      await db.createGenerationPlan(expired, "test");
      expect(
        readResult(
          await submitMediaGenerationTool.run(
            { planId: expired.id },
            context(db, client),
          ),
        ),
      ).toMatchObject({ success: false });

      const tampered = prepareGenerationPlan(
        [{ tool: "nano_banana_image", args: { prompt: "Tampered" } }],
        new Map([["nano_banana_image", nanoBananaImageTool]]),
      );
      await db.createGenerationPlan(
        { ...tampered, requestHash: "tampered" },
        "test",
      );
      expect(
        readResult(
          await submitMediaGenerationTool.run(
            { planId: tampered.id },
            context(db, client),
          ),
        ),
      ).toMatchObject({ success: false });
      expect(client.generateNanoBananaImage).not.toHaveBeenCalled();
    } finally {
      await cleanup();
    }
  });

  test("filters catalog capabilities and surfaces provider-reported credits separately", async () => {
    expect(filterCatalog("lip sync").map((entry) => entry.toolName)).toEqual(
      expect.arrayContaining(["infinitalk_lip_sync", "kling_avatar"]),
    );
    const { db, cleanup } = testDatabase();
    try {
      await db.createTask({
        task_id: "credits-task",
        api_type: "nano-banana-image",
        status: "pending",
      });
      const result = await getTaskStatusTool.run(
        { task_id: "credits-task" },
        context(db, {
          getTaskStatus: jest.fn(async () => ({
            data: {
              state: "success",
              creditsConsumed: 7,
              resultJson: JSON.stringify({
                resultUrls: ["https://example.com/result.png"],
              }),
            },
          })),
        }),
      );
      expect(readResult(result)).toMatchObject({ creditsConsumed: 7 });
      expect((await db.getTask("credits-task"))?.credits_consumed).toBe(7);
    } finally {
      await cleanup();
    }
  });
});

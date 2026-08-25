import { openAiModelList } from "../src/model-catalog.js";
import {
  activeCoreMediaTools,
  OPENAI_EXCLUSIONS,
  OPENAI_STATUS_STRATEGIES,
  openAiAdapter,
  RESOLVED_OPENAI_ADAPTERS,
  unaccountedCoreMediaTools,
} from "../src/registry/index.js";

describe("OpenAI adapter registry", () => {
  test("resolves every advertised model from an active core tool", () => {
    expect(
      RESOLVED_OPENAI_ADAPTERS.map((adapter) => adapter.publicModelId),
    ).toEqual([
      "kie-nano-banana-image",
      "kie-gpt-image-2",
      "kie-z-image",
      "kie-bytedance-video",
      "kie-bytedance-fast-video",
    ]);
    expect(
      new Set(RESOLVED_OPENAI_ADAPTERS.map((adapter) => adapter.publicModelId))
        .size,
    ).toBe(RESOLVED_OPENAI_ADAPTERS.length);
    expect(
      RESOLVED_OPENAI_ADAPTERS.every(
        (adapter) =>
          adapter.allowedResultHosts.length > 0 &&
          adapter.resultHostEvidenceUrl.startsWith("https://"),
      ),
    ).toBe(true);
  });

  test("preserves the contract-2 public descriptor surface", () => {
    expect(
      RESOLVED_OPENAI_ADAPTERS.filter(
        (adapter) => adapter.publicModelId !== "kie-z-image",
      ).map((adapter) => ({
        id: adapter.publicModelId,
        tool: adapter.toolName,
        media: adapter.mediaType,
        apiType: adapter.apiType,
        operations: adapter.operations,
      })),
    ).toEqual([
      {
        id: "kie-nano-banana-image",
        tool: "nano_banana_image",
        media: "image",
        apiType: "nano-banana-image",
        operations: ["generation", "edit"],
      },
      {
        id: "kie-gpt-image-2",
        tool: "gpt_image_2",
        media: "image",
        apiType: "gpt-image-2",
        operations: ["generation", "edit"],
      },
      {
        id: "kie-bytedance-video",
        tool: "bytedance_seedance_video",
        media: "video",
        apiType: "bytedance-seedance-video",
        operations: ["text-to-video", "image-to-video", "reference-to-video"],
      },
      {
        id: "kie-bytedance-fast-video",
        tool: "bytedance_seedance_video",
        media: "video",
        apiType: "bytedance-seedance-video",
        operations: ["text-to-video", "image-to-video", "reference-to-video"],
      },
    ]);
  });

  test("accounts for all active core image and video tools", () => {
    expect(activeCoreMediaTools().length).toBeGreaterThan(0);
    expect(unaccountedCoreMediaTools()).toEqual([]);
    expect(Object.keys(OPENAI_EXCLUSIONS)).toContain("topaz_upscale_image");
    expect(
      Object.values(OPENAI_EXCLUSIONS).every((reason) => reason.trim()),
    ).toBe(true);
    expect(
      Object.keys(OPENAI_EXCLUSIONS).every((toolName) =>
        activeCoreMediaTools().includes(toolName),
      ),
    ).toBe(true);
  });

  test("derives discovery from the same resolved adapters", () => {
    expect(openAiModelList().data.map((model) => model.id)).toEqual(
      RESOLVED_OPENAI_ADAPTERS.slice()
        .sort(
          (a, b) =>
            a.mediaType.localeCompare(b.mediaType) ||
            a.publicModelId.localeCompare(b.publicModelId),
        )
        .map((adapter) => adapter.publicModelId),
    );
    expect(openAiAdapter("kie-z-image", "image")?.toolName).toBe("z_image");
  });

  test("declares executable cardinality, operations, aliases, and Infinite Canvas names", () => {
    for (const adapter of RESOLVED_OPENAI_ADAPTERS) {
      expect(
        adapter.publicModelId === "kie-gpt-image-2" ||
          /-(image|video)$/.test(adapter.publicModelId),
      ).toBe(true);
      expect(adapter.operations.length).toBeGreaterThan(0);
      expect(adapter.cardinality.expectedResultsPerTask).toBe(1);
      expect(OPENAI_STATUS_STRATEGIES[adapter.statusStrategy]).toBeDefined();
      if (adapter.mediaType === "image") {
        expect(adapter.normalizeSubmission).toBeDefined();
        expect(adapter.submit).toBeDefined();
      }
    }
    expect(openAiAdapter("kie-bytedance-fast-video")?.toolName).toBe(
      "bytedance_seedance_video",
    );
  });
});

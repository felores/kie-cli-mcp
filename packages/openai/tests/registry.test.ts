import { openAiModelList } from "../src/model-catalog.js";
import {
  activeCoreMediaTools,
  OPENAI_EXCLUSIONS,
  OPENAI_OPERATION_EXCLUSIONS,
  OPENAI_STATUS_STRATEGIES,
  type OpenAiImageAdapter,
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
      "kie-seedream-5-pro-image",
      "kie-qwen-image",
      "kie-flux-2-pro-image",
      "kie-flux-kontext-pro-image",
      "kie-bytedance-video",
      "kie-bytedance-fast-video",
      "kie-kling-3-video",
      "kie-minimax-h3-video",
      "kie-veo3-video",
      "kie-wan-3-0-video",
      "kie-wan-2-7-video",
      "kie-happyhorse-1-0-video",
      "kie-midjourney-video",
      "kie-grok-video",
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
      RESOLVED_OPENAI_ADAPTERS.filter((adapter) =>
        [
          "kie-nano-banana-image",
          "kie-gpt-image-2",
          "kie-bytedance-video",
          "kie-bytedance-fast-video",
        ].includes(adapter.publicModelId),
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
    expect(OPENAI_EXCLUSIONS).not.toHaveProperty("midjourney_generate");
    expect(OPENAI_EXCLUSIONS).not.toHaveProperty("grok_imagine");
    expect(OPENAI_OPERATION_EXCLUSIONS.midjourney_generate).toEqual(
      expect.objectContaining({
        "text-to-image": expect.any(String),
        "image-to-image": expect.any(String),
      }),
    );
    expect(OPENAI_OPERATION_EXCLUSIONS.grok_imagine).toEqual(
      expect.objectContaining({
        "text-to-image": expect.any(String),
        "image-to-image": expect.any(String),
        upscale: expect.any(String),
      }),
    );
    for (const adapted of [
      "bytedance_seedream_image",
      "qwen_image",
      "flux2_image",
      "flux_kontext_image",
      "kling_video",
      "hailuo_video",
      "veo3_generate_video",
      "wan_video",
      "happyhorse_video",
    ]) {
      expect(OPENAI_EXCLUSIONS).not.toHaveProperty(adapted);
    }
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
    for (const model of [
      "kie-seedream-5-pro-image",
      "kie-qwen-image",
      "kie-flux-2-pro-image",
      "kie-flux-kontext-pro-image",
    ]) {
      expect(openAiAdapter(model, "image")).toBeDefined();
    }
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
      } else {
        expect(Object.keys(adapter.presets).length).toBeGreaterThan(0);
        expect(
          adapter.referenceLimits.maxImageReferences,
        ).toBeGreaterThanOrEqual(0);
        expect(adapter.referenceLimits.maxReferenceBytes).toBeGreaterThan(0);
        expect(adapter.referenceLimits.evidenceUrl).toMatch(/^https:\/\//);
        if (adapter.defaultPreset !== undefined) {
          expect(Object.hasOwn(adapter.presets, adapter.defaultPreset)).toBe(
            true,
          );
        }
      }
    }
    expect(openAiAdapter("kie-bytedance-fast-video")?.toolName).toBe(
      "bytedance_seedance_video",
    );
    expect(openAiAdapter("kie-wan-2-7-video")?.toolName).toBe("wan_video");
    expect(openAiAdapter("kie-midjourney-video")?.mixedMediaReason).toContain(
      "image-to-video",
    );
    expect(openAiAdapter("kie-grok-video")?.operations).toEqual([
      "text-to-video",
      "image-to-video",
    ]);
  });

  test("uses IDs that Infinite Canvas classifies as their advertised media type", () => {
    const classify = (id: string): "image" | "video" | "unknown" =>
      id.includes("-image")
        ? "image"
        : id.includes("-video")
          ? "video"
          : "unknown";
    for (const adapter of RESOLVED_OPENAI_ADAPTERS) {
      expect(classify(adapter.publicModelId)).toBe(adapter.mediaType);
    }
  });

  test("preserves expanded image format, reference, and polling contracts", () => {
    const contracts = Object.fromEntries(
      RESOLVED_OPENAI_ADAPTERS.filter(
        (adapter): adapter is OpenAiImageAdapter =>
          adapter.mediaType === "image" &&
          [
            "kie-seedream-5-pro-image",
            "kie-qwen-image",
            "kie-flux-2-pro-image",
            "kie-flux-kontext-pro-image",
          ].includes(adapter.publicModelId),
      ).map((adapter) => [
        adapter.publicModelId,
        {
          formats: Object.keys(adapter.outputFormats),
          references: adapter.maxReferences,
          transportReferenceMiB: adapter.maxReferenceBytes / (1024 * 1024),
          providerReferenceMiB:
            adapter.providerMaxReferenceBytes === undefined
              ? null
              : adapter.providerMaxReferenceBytes / (1024 * 1024),
          status: adapter.statusStrategy,
          results: adapter.cardinality.expectedResultsPerTask,
        },
      ]),
    );
    expect(contracts).toEqual({
      "kie-seedream-5-pro-image": {
        formats: ["png", "jpg", "jpeg"],
        references: 10,
        transportReferenceMiB: 25,
        providerReferenceMiB: 30,
        status: "jobs",
        results: 1,
      },
      "kie-qwen-image": {
        formats: ["png", "jpg", "jpeg"],
        references: 1,
        transportReferenceMiB: 10,
        providerReferenceMiB: 10,
        status: "jobs",
        results: 1,
      },
      "kie-flux-2-pro-image": {
        formats: ["png"],
        references: 8,
        transportReferenceMiB: 25,
        providerReferenceMiB: 30,
        status: "jobs",
        results: 1,
      },
      "kie-flux-kontext-pro-image": {
        formats: ["png", "jpg", "jpeg"],
        references: 1,
        transportReferenceMiB: 25,
        providerReferenceMiB: null,
        status: "flux-kontext",
        results: 1,
      },
    });
  });
});

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { jest } from "@jest/globals";
import { TaskDatabase } from "../database.js";
import { prepareGenerationPlan } from "../generation-plan.js";
import { KieAiClient } from "../kie-ai-client.js";
import { getTool, TOOL_REGISTRY } from "../tools/index.js";
import type { ToolContext } from "../tools/types.js";

const image = "https://example.com/image.png";
const callback = "https://example.com/callback";
const prompt = "A cinematic product photo";
let directory: string;
let ctx: ToolContext;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "kie-current-models-"));
  ctx = {
    db: new TaskDatabase(join(directory, "tasks.db")),
    client: new KieAiClient({
      apiKey: "test-key",
      baseUrl: "https://provider.example/api/v1",
      timeout: 1000,
      callbackUrlFallback: callback,
    }),
    approvalContext: "test",
    getTool,
    getCallbackUrl: (url) => url ?? callback,
    formatError: (_name, error) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify({ success: false, error: String(error) }),
        },
      ],
    }),
  };
});

afterEach(async () => {
  jest.restoreAllMocks();
  await ctx.db.close();
  rmSync(directory, { recursive: true, force: true });
});

interface RouteCase {
  tool: string;
  args: Record<string, unknown>;
  model: string;
  input: Record<string, unknown>;
  apiType: string;
  planModel?: string;
}
const routes: RouteCase[] = [
  ...["V6", "V6_MINI", "V6_WILD"].map((model) => ({
    tool: "suno_generate_music",
    model: "ai-music-api/generate",
    planModel: model,
    apiType: "suno-v6",
    args: {
      model,
      customMode: true,
      instrumental: false,
      title: "Song",
      lyrics: "Hello world",
      duration: 30,
      vocalGender: "f",
      styleWeight: 0,
      personaId: "voice-1",
      personaModel: "voice_persona",
      variety: 0,
    },
    input: {
      model,
      custom_mode: true,
      lyrics: "Hello world",
      duration: 30,
      vocal_gender: "f",
      style_weight: 0,
      persona_id: "voice-1",
      persona_model: "voice_persona",
      variety: 0,
    },
  })),
  {
    tool: "suno_generate_music",
    model: "ai-music-api/generate",
    planModel: "V6",
    apiType: "suno-v6",
    args: { customMode: false, instrumental: true, image_urls: [image] },
    input: {
      model: "V6",
      custom_mode: false,
      instrumental: true,
      image_urls: [image],
    },
  },
  ...["flare", "sunburst"].flatMap((model) =>
    [false, true].map((edit) => ({
      tool: "gpt_image_2",
      model: `gpt-image-2-5-${model}-${edit ? "image-to-image" : "text-to-image"}`,
      apiType: "gpt-image-2",
      args: {
        model,
        prompt,
        background: "transparent",
        ...(edit && { input_urls: [image] }),
      },
      input: {
        prompt,
        background: "transparent",
        resolution: "1K",
        aspect_ratio: "auto",
        ...(edit && { input_urls: [image] }),
      },
    })),
  ),
  ...["5-pro", "5-flash"].flatMap((version) =>
    [false, true].map((edit) => ({
      tool: "bytedance_seedream_image",
      model: `seedream/${version}-${edit ? "image-to-image" : "text-to-image"}`,
      apiType: "bytedance-seedream-image",
      args: {
        version,
        prompt,
        ...(edit && { image_urls: [image] }),
        ...(version === "5-pro" ? { quality: "high" } : { size: "1.5K" }),
      },
      input: {
        prompt,
        output_format: "png",
        aspect_ratio: "1:1",
        ...(version === "5-pro" ? { quality: "high" } : { size: "1.5K" }),
        ...(edit && { image_urls: [image] }),
      },
    })),
  ),
  ...["5-pro", "5-flash"].map((version) => ({
    tool: "bytedance_seedream_image",
    model: `seedream/${version}-layer-decomposition`,
    apiType: "bytedance-seedream-image",
    args: { version, image_url: image },
    input: { image_url: image, size: "auto", output_format: "jpeg" },
  })),
  ...["qwen3", "qwen3-pro"].flatMap((model) =>
    [false, true].map((edit) => ({
      tool: "qwen_image",
      model: `qwen3/${model === "qwen3-pro" ? "pro-" : ""}${edit ? "image-to-image" : "text-to-image"}`,
      apiType: "qwen-image",
      args: {
        model,
        prompt,
        seed: 0,
        prompt_extend: false,
        resolution: "2K",
        ...(edit && { image_urls: [image, image, image] }),
      },
      input: {
        prompt,
        seed: 0,
        prompt_extend: false,
        resolution: "2K",
        image_size: "16:9",
        output_format: "png",
        ...(edit && { image_urls: [image, image, image] }),
      },
    })),
  ),
  ...["text-to-video", "image-to-video", "reference-to-video"].map((mode) => ({
    tool: "happyhorse_video",
    model: `happyhorse-1-1/${mode}`,
    apiType: "happyhorse-video",
    args: {
      ...(mode !== "image-to-video" && { prompt }),
      ...(mode === "image-to-video" && { image_urls: [image] }),
      ...(mode === "reference-to-video" && { reference_image: [image] }),
    },
    input: {
      resolution: "1080p",
      duration: 5,
      ...(mode !== "image-to-video" && { prompt, aspect_ratio: "16:9" }),
      ...(mode === "image-to-video" && { image_urls: [image] }),
      ...(mode === "reference-to-video" && { reference_image: [image] }),
    },
  })),
  ...["wan/3-0-video", "wan/3-0-video-prime"].map((model) => ({
    tool: "wan_video",
    model,
    apiType: "wan-video",
    args: {
      model,
      prompt,
      duration: -1,
      audio: false,
      reference_video_urls: ["https://example.com/video.mp4"],
    },
    input: {
      prompt,
      duration: -1,
      audio: false,
      resolution: "1080P",
      aspect_ratio: "adaptive",
      reference_video_urls: ["https://example.com/video.mp4"],
    },
  })),
  ...["wan/2-7-image", "wan/2-7-image-pro"].flatMap((model) =>
    [false, true].map((edit) => ({
      tool: "wan_image",
      model,
      apiType: "wan-image",
      args: {
        model,
        prompt,
        ...(edit && { input_urls: [image], bbox_list: [[[1, 2, 3, 4]]] }),
      },
      input: {
        prompt,
        resolution: "2K",
        enable_sequential: false,
        n: 4,
        ...(edit && { input_urls: [image], bbox_list: [[[1, 2, 3, 4]]] }),
      },
    })),
  ),
  {
    tool: "wan_image",
    model: "wan/2-7-image",
    apiType: "wan-image",
    args: { prompt, enable_sequential: true },
    input: { prompt, enable_sequential: true, resolution: "2K", n: 12 },
  },
];

test.each(routes)(
  "$tool routes $model and persists/polls the task",
  async ({ tool, args, model, input, apiType, planModel }) => {
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockImplementation(
        async () =>
          new Response(
            JSON.stringify({ code: 200, data: { taskId: "task-1" } }),
          ),
      );
    const result = await getTool(tool)!.run(args, ctx);
    expect(JSON.parse(result.content[0].text).success).toBe(true);
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.model).toBe(model);
    expect(body.input).toMatchObject(input);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://provider.example/api/v1/jobs/createTask",
    );
    const task = await ctx.db.getTask("task-1");
    expect(task).toMatchObject({ api_type: apiType, status: "pending" });
    await ctx.client.getTaskStatus("task-1", task!.api_type);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain(
      "/jobs/recordInfo?taskId=task-1",
    );
    const plan = prepareGenerationPlan(
      [{ tool, args }],
      new Map(TOOL_REGISTRY.map((item) => [item.name, item])),
    );
    expect(plan.items[0].model).toBe(planModel ?? model);
    expect(plan.items[0].price.status).toBe("unknown");
    if (tool === "wan_image") expect(plan.items[0].outputCount).toBe(input.n);
    if (tool === "happyhorse_video")
      expect(body).not.toHaveProperty("callBackUrl");
    else expect(body.callBackUrl).toBe(callback);
  },
);

test.each([
  [
    "suno_generate_music",
    {
      customMode: true,
      instrumental: true,
      title: "Song",
      style: "Jazz",
      model: "V5_5",
    },
  ],
  [
    "suno_generate_music",
    { customMode: false, instrumental: true, prompt: "Jazz" },
  ],
  [
    "suno_generate_music",
    { customMode: false, instrumental: true, style: "Jazz", duration: 30 },
  ],
  [
    "suno_generate_music",
    {
      customMode: false,
      instrumental: false,
      style: "Jazz",
      lyrics: "Song",
      audio_urls: Array(9).fill(image),
    },
  ],
  [
    "suno_generate_music",
    {
      customMode: true,
      instrumental: true,
      title: "Song",
      style: "Jazz",
      audioWeight: 0.5,
    },
  ],
  ["gpt_image_2", { prompt, model: "gpt-image-2" }],
  ["gpt_image_2", { prompt, aspect_ratio: "27:16", resolution: "2K" }],
  ["bytedance_seedream_image", { prompt, version: "5-lite" }],
  ["bytedance_seedream_image", { prompt, image_resolution: "4K" }],
  ["bytedance_seedream_image", { prompt, version: "5-flash", quality: "high" }],
  ["bytedance_seedream_image", { image_url: image, image_urls: [image] }],
  ["qwen_image", { prompt, image_url: image }],
  ["qwen_image", { prompt, num_inference_steps: 30 }],
  ["happyhorse_video", { prompt, mode: "video-edit", video_url: image }],
  [
    "happyhorse_video",
    { prompt, image_urls: [image], reference_image: [image] },
  ],
  ["wan_video", { prompt, model: "wan/2-7-text-to-video" }],
  ["wan_image", { prompt, n: 5 }],
  ["wan_image", { prompt, input_urls: [image], thinking_mode: true }],
  ["wan_image", { prompt, input_urls: [image], bbox_list: [] }],
  [
    "wan_image",
    {
      prompt,
      model: "wan/2-7-image-pro",
      input_urls: [image],
      resolution: "4K",
    },
  ],
] as Array<[string, Record<string, unknown>]>)(
  "%s rejects retired or invalid intent before provider calls",
  async (tool, args) => {
    const fetchMock = jest.spyOn(globalThis, "fetch");
    expect(
      JSON.parse((await getTool(tool)!.run(args, ctx)).content[0].text).success,
    ).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  },
);

test("Suno V6 synchronizes all audio URLs through unified jobs polling", async () => {
  await ctx.db.createTask({
    task_id: "audio-1",
    api_type: "suno-v6",
    status: "pending",
  });
  const urls = ["https://example.com/one.mp3", "https://example.com/two.mp3"];
  jest.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        code: 200,
        data: {
          state: "success",
          resultJson: JSON.stringify({ resultUrls: urls }),
        },
      }),
    ),
  );
  const result = await getTool("get_task_status")!.run(
    { task_id: "audio-1" },
    ctx,
  );
  expect(JSON.parse(result.content[0].text)).toMatchObject({
    result_urls: urls,
  });
  expect(await ctx.db.getTask("audio-1")).toMatchObject({
    status: "completed",
    result_url: urls[0],
  });
});

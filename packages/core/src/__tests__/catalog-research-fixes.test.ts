import { jest } from "@jest/globals";
import { KieAiClient } from "../kie-ai-client.js";
import { ElevenLabsTTSSchema, TopazUpscaleImageSchema } from "../types.js";

const config = {
  apiKey: "test-key",
  baseUrl: "https://provider.example/api/v1",
  timeout: 1_000,
  callbackUrlFallback: "",
};

function mockCreateTask() {
  return jest.spyOn(globalThis, "fetch").mockImplementation(
    async () =>
      new Response(JSON.stringify({ code: 200, data: { taskId: "task-1" } }), {
        headers: { "content-type": "application/json" },
      }),
  );
}

function sentBody(fetchMock: ReturnType<typeof mockCreateTask>) {
  return JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("Kling Avatar model IDs", () => {
  test.each([
    ["standard", "kling/ai-avatar-standard"],
    ["pro", "kling/ai-avatar-pro"],
  ] as const)("%s quality sends %s", async (quality, model) => {
    const fetchMock = mockCreateTask();
    await new KieAiClient(config).generateKlingAvatar({
      image_url: "https://example.com/face.png",
      audio_url: "https://example.com/voice.mp3",
      prompt: "Speak calmly",
      quality,
    });
    expect(sentBody(fetchMock).model).toBe(model);
  });
});

describe("ElevenLabs voice IDs", () => {
  test.each([
    [undefined, "EkK5I93UQWFDigLMpZcX"],
    ["Aria", "TC0Zp7WVFzhA8zpTlRqV"],
    ["N2lVS1w4EtoT3dr4eOWO", "N2lVS1w4EtoT3dr4eOWO"],
  ])("voice %s is sent as %s", async (voice, expected) => {
    const fetchMock = mockCreateTask();
    await new KieAiClient(config).generateElevenLabsTTS({
      text: "Hello",
      ...(voice ? { voice } : {}),
    });
    expect(sentBody(fetchMock).input.voice).toBe(expected);
  });

  test("schema accepts a voice ID", () => {
    expect(
      ElevenLabsTTSSchema.safeParse({
        text: "Hello",
        voice: "N2lVS1w4EtoT3dr4eOWO",
      }).success,
    ).toBe(true);
  });
});

describe("Topaz upscale factor", () => {
  test.each(["1", "2", "4"])("accepts %sx", (upscale_factor) => {
    expect(
      TopazUpscaleImageSchema.safeParse({
        image_url: "https://example.com/a.png",
        upscale_factor,
      }).success,
    ).toBe(true);
  });

  test("rejects 8x, which Kie.ai does not list", () => {
    expect(
      TopazUpscaleImageSchema.safeParse({
        image_url: "https://example.com/a.png",
        upscale_factor: "8",
      }).success,
    ).toBe(false);
  });
});

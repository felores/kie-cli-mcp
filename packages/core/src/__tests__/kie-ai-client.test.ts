import { jest } from "@jest/globals";
import { KieAiClient } from "../kie-ai-client.js";

const config = {
  apiKey: "test-key",
  baseUrl: "https://provider.example/api/v1",
  timeout: 1_000,
  callbackUrlFallback: "",
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe("KieAiClient transport safety", () => {
  test("preserves provider HTTP diagnostics on rejected requests", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ code: 422, msg: "invalid aspect ratio" }), {
        status: 422,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(
      new KieAiClient(config).generateGptImage2({ prompt: "test" }),
    ).rejects.toMatchObject({
      message: "HTTP 422: invalid aspect ratio",
      status: 422,
      providerCode: 422,
    });
  });

  test("does not read the process callback fallback", async () => {
    const previous = process.env.KIE_AI_CALLBACK_URL;
    process.env.KIE_AI_CALLBACK_URL = "https://secret.example/callback";
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ code: 200, data: { taskId: "task-1" } }), {
        headers: { "content-type": "application/json" },
      }),
    );

    try {
      await new KieAiClient(config).generateGptImage2({ prompt: "test" });
      const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
        callBackUrl?: string;
      };
      expect(body.callBackUrl).toBeUndefined();
    } finally {
      if (previous === undefined) delete process.env.KIE_AI_CALLBACK_URL;
      else process.env.KIE_AI_CALLBACK_URL = previous;
    }
  });

  test("caps streamed result downloads", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3, 4, 5])),
    );

    await expect(
      new KieAiClient(config).downloadFile("https://file.aiquickdraw.com/result.png", {
        maxBytes: 4,
      }),
    ).rejects.toMatchObject({
      message: "The provider result exceeded the download size limit.",
      status: 502,
    });
  });
});

describe("KieAiClient file upload routing", () => {
  const uploadConfig = {
    ...config,
    fileUploadBaseUrl: "https://uploads.example",
  };

  test("hands public URLs to Kie instead of fetching them", async () => {
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 200,
          msg: "ok",
          data: { downloadUrl: "https://tempfile.redpandaai.co/result.png" },
        }),
        { headers: { "content-type": "application/json" } },
      ),
    );

    const response = await new KieAiClient(uploadConfig).uploadFromUrl({
      fileUrl: "https://public.example/reference.png",
      uploadPath: "files/user-uploads",
      fileName: "reference.png",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://uploads.example/api/file-url-upload",
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      redirect: "error",
      headers: {
        Authorization: "Bearer test-key",
        "Content-Type": "application/json",
      },
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      fileUrl: "https://public.example/reference.png",
      uploadPath: "files/user-uploads",
      fileName: "reference.png",
    });
    expect(response.data?.fileUrl).toBe(
      "https://tempfile.redpandaai.co/result.png",
    );
  });

  test("uses the official Base64 endpoint and rejects redirect following", async () => {
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 200,
          data: { downloadUrl: "https://tempfile.redpandaai.co/result.png" },
        }),
        { headers: { "content-type": "application/json" } },
      ),
    );

    await new KieAiClient(uploadConfig).uploadBase64({
      base64Data: "data:image/png;base64,iVBORw0KGgo=",
      uploadPath: "images/user-uploads",
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://uploads.example/api/file-base64-upload",
    );
    expect(fetchMock.mock.calls[0]?.[1]?.redirect).toBe("error");
  });

  test("rejects unsafe operator upload base URLs before fetch", async () => {
    const fetchMock = jest.spyOn(globalThis, "fetch");
    await expect(
      new KieAiClient({
        ...config,
        fileUploadBaseUrl: "http://attacker.example",
      }).uploadFromUrl({
        fileUrl: "https://public.example/reference.png",
        uploadPath: "files/user-uploads",
      }),
    ).rejects.toThrow(/must be HTTPS/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("rejects unsafe upload URLs returned by the provider", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 200,
          data: { downloadUrl: "http://127.0.0.1/internal" },
        }),
        { headers: { "content-type": "application/json" } },
      ),
    );
    await expect(
      new KieAiClient(uploadConfig).uploadFromUrl({
        fileUrl: "https://public.example/reference.png",
        uploadPath: "files/user-uploads",
      }),
    ).rejects.toThrow(/Kie upload result URL must be a public/);
  });
});

describe("KieAiClient MiniMax H3 routing", () => {
  test("sends text-to-video requests to the exact H3 model and payload", async () => {
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ code: 200, data: { taskId: "task-1" } }), {
        headers: { "content-type": "application/json" },
      }),
    );

    await new KieAiClient(config).generateHailuoVideo({
      prompt: "A cinematic sunset over the ocean",
      duration: 6,
      aspectRatio: "16:9",
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://provider.example/api/v1/jobs/createTask",
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      model: "minimax-h3/text-to-video",
      input: {
        prompt: "A cinematic sunset over the ocean",
        duration: 6,
        aspect_ratio: "16:9",
      },
    });
  });

  test("maps public frame and reference fields to H3 payload names", async () => {
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ code: 200, data: { taskId: "task-1" } }),
          { headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ code: 200, data: { taskId: "task-2" } }),
          { headers: { "content-type": "application/json" } },
        ),
      );
    const client = new KieAiClient(config);

    await client.generateHailuoVideo({
      prompt: "Move naturally toward the final frame",
      imageUrl: "https://example.com/first.jpg",
      endImageUrl: "https://example.com/last.jpg",
      duration: 6,
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      model: "minimax-h3/image-to-video",
      input: {
        prompt: "Move naturally toward the final frame",
        duration: 6,
        first_frame_url: "https://example.com/first.jpg",
        last_frame_url: "https://example.com/last.jpg",
      },
    });

    await client.generateHailuoVideo({
      prompt: "Use the references to preserve identity and voice",
      referenceImageUrls: ["https://example.com/character.jpg"],
      referenceVideoUrls: ["https://example.com/motion.mp4"],
      referenceAudioUrls: ["https://example.com/voice.mp3"],
      duration: 8,
      aspectRatio: "adaptive",
      resolution: "768p",
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      model: "minimax-h3/reference-to-video",
      input: {
        prompt: "Use the references to preserve identity and voice",
        duration: 8,
        reference_image_urls: ["https://example.com/character.jpg"],
        reference_video_urls: ["https://example.com/motion.mp4"],
        reference_audio_urls: ["https://example.com/voice.mp3"],
        aspect_ratio: "adaptive",
        resolution: "768p",
      },
    });
  });
});

describe("KieAiClient Seedance 2.5 routing", () => {
  test("sends the exact 2.5 model and documented payload", async () => {
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ code: 200, data: { taskId: "task-1" } }), {
        headers: { "content-type": "application/json" },
      }),
    );

    await new KieAiClient(config).generateByteDanceSeedanceVideo({
      prompt: "A serene beach at sunset",
      first_frame_url: "https://example.com/first.png",
      last_frame_url: "https://example.com/last.png",
      return_last_frame: true,
      generate_audio: false,
      resolution: "720p",
      aspect_ratio: "16:9",
      duration: 15,
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://provider.example/api/v1/jobs/createTask",
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      model: "bytedance/seedance-2-5",
      input: {
        prompt: "A serene beach at sunset",
        first_frame_url: "https://example.com/first.png",
        last_frame_url: "https://example.com/last.png",
        return_last_frame: true,
        generate_audio: false,
        resolution: "720p",
        aspect_ratio: "16:9",
        duration: 15,
      },
    });
  });

  test("omits return_last_frame when it is not provided", async () => {
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ code: 200, data: { taskId: "task-1" } }), {
        headers: { "content-type": "application/json" },
      }),
    );

    await new KieAiClient(config).generateByteDanceSeedanceVideo({
      prompt: "A text-only video",
    });

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      model: "bytedance/seedance-2-5",
      input: { prompt: "A text-only video" },
    });
  });

  test("sends extension_task_id inside the Seedance input", async () => {
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ code: 200, data: { taskId: "task-2" } }), {
        headers: { "content-type": "application/json" },
      }),
    );

    await new KieAiClient(config).generateByteDanceSeedanceVideo({
      prompt: "Continue the scene with the same subject and setting",
      extension_task_id: "previous-seedance-task",
      duration: 5,
    });

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      model: "bytedance/seedance-2-5",
      input: {
        prompt: "Continue the scene with the same subject and setting",
        extension_task_id: "previous-seedance-task",
        duration: 5,
      },
    });
  });
});

describe("KieAiClient Grok Imagine routing", () => {
  const response = () =>
    new Response(JSON.stringify({ code: 200, data: { taskId: "task-1" } }), {
      headers: { "content-type": "application/json" },
    });

  test.each([
    [
      "Image 2.0 text-to-image",
      {
        generation_mode: "text-to-image" as const,
        prompt: "A cinematic portrait",
      },
      "grok-imagine-image-2-0/text-to-image",
      { prompt: "A cinematic portrait", aspect_ratio: "1:1" },
    ],
    [
      "Image 2.0 image-to-image",
      {
        generation_mode: "image-to-image" as const,
        prompt: "Paint this in watercolor",
        image_urls: ["https://example.com/reference.png"],
      },
      "grok-imagine-image-2-0/image-edit",
      {
        prompt: "Paint this in watercolor",
        aspect_ratio: "1:1",
        image_urls: ["https://example.com/reference.png"],
      },
    ],
    [
      "prompt-only auto text-to-video",
      { prompt: "A fox runs" },
      "grok-imagine/text-to-video",
      { prompt: "A fox runs", aspect_ratio: "1:1", mode: "normal" },
    ],
    [
      "image URL auto image-to-video",
      { image_urls: ["https://example.com/first.png"] },
      "grok-imagine/image-to-video",
      { image_urls: ["https://example.com/first.png"], mode: "normal" },
    ],
    [
      "task-only auto upscale",
      { task_id: "previous-task" },
      "grok-imagine/upscale",
      { task_id: "previous-task" },
    ],
  ])("routes %s to the expected model and input", async (_name, request, model, input) => {
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(response());

    await new KieAiClient(config).generateGrokImagine(request);

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      model,
      input,
    });
  });
});

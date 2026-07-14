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

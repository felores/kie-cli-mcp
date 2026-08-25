import { once } from "node:events";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { jest } from "@jest/globals";
import express from "express";
import { createKieOpenAiRouter } from "../src/http-server.js";

const providerBaseUrl = "https://provider.example/api/v1";
const resultOptions = {
  allowedResultHosts: ["cdn.example"],
  allowedResultHostsByModel: {
    "kie-seedream-5-pro-image": ["cdn.example"],
    "kie-qwen-image": ["cdn.example"],
    "kie-flux-2-pro-image": ["cdn.example"],
    "kie-flux-kontext-pro-image": ["cdn.example"],
  },
};
const originalFetch = globalThis.fetch;
const servers: Server[] = [];

function imageBytes(prefix: number[], value: string): ArrayBuffer {
  const body = Buffer.from(value);
  const bytes = new Uint8Array(prefix.length + body.length);
  bytes.set(prefix);
  bytes.set(body, prefix.length);
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function pngBytes(value: string): ArrayBuffer {
  return imageBytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], value);
}

function jpegBytes(value: string): ArrayBuffer {
  return imageBytes([0xff, 0xd8, 0xff], value);
}

async function serve(app: express.Express): Promise<string> {
  const server = app.listen(0, "127.0.0.1");
  servers.push(server);
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

async function responseJson(
  response: Response,
): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function makeDataDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "kie-openai-image-"));
}

async function closeServers(): Promise<void> {
  for (const server of servers.splice(0)) {
    server.close();
    await once(server, "close");
  }
}

afterEach(async () => {
  jest.restoreAllMocks();
  await closeServers();
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

describe("KIE OpenAI image contract", () => {
  test("maps Nano Banana generation fields, fans out at two, and preserves order", async () => {
    const dataDir = await makeDataDir();
    const createdBodies: Record<string, unknown>[] = [];
    const activeCreates = { value: 0, maximum: 0 };
    let taskNumber = 0;
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === `${providerBaseUrl}/jobs/createTask`) {
        activeCreates.value += 1;
        activeCreates.maximum = Math.max(
          activeCreates.maximum,
          activeCreates.value,
        );
        createdBodies.push(
          JSON.parse(String(init?.body)) as Record<string, unknown>,
        );
        const taskId = `task-${taskNumber++}`;
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 2));
        activeCreates.value -= 1;
        return jsonResponse({ code: 200, msg: "success", data: { taskId } });
      }
      if (url.startsWith(`${providerBaseUrl}/jobs/recordInfo`)) {
        const taskId = new URL(url).searchParams.get("taskId");
        return jsonResponse({
          code: 200,
          data: {
            state: "success",
            resultJson: JSON.stringify({
              resultUrls: [`https://cdn.example/${taskId}.png`],
            }),
          },
        });
      }
      if (url.startsWith("https://cdn.example/")) {
        return new Response(pngBytes(`png-${url.split("/").pop()}`), {
          status: 200,
          headers: { "content-type": "image/png" },
        });
      }
      return originalFetch(input, init);
    });

    const baseUrl = await serve(
      express().use(
        createKieOpenAiRouter({
          ...resultOptions,
          apiKey: "provider-key",
          baseUrl: providerBaseUrl,
          dataDir,
          pollIntervalMs: 1,
          pollTimeoutMs: 100,
        }),
      ),
    );
    const response = await fetch(`${baseUrl}/v1/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "nano-order-1",
      },
      body: JSON.stringify({
        model: "kie-nano-banana-image",
        prompt: "A red kite",
        n: 5,
        quality: "hd",
        size: "1024x1024",
        response_format: "b64_json",
        output_format: "png",
      }),
    });

    expect(response.status).toBe(200);
    const body = await responseJson(response);
    expect(body.data).toEqual(
      ["task-0", "task-1", "task-2", "task-3", "task-4"].map((taskId) => ({
        b64_json: Buffer.from(pngBytes(`png-${taskId}.png`)).toString("base64"),
      })),
    );
    expect(activeCreates.maximum).toBe(2);
    expect(createdBodies).toHaveLength(5);
    expect(createdBodies[0]).toEqual({
      model: "nano-banana-2",
      input: {
        prompt: "A red kite",
        output_format: "png",
        aspect_ratio: "1:1",
        resolution: "2K",
        image_input: [],
      },
    });

    await rm(dataDir, { recursive: true, force: true });
  });

  test("maps GPT Image 2 and accepts only the exact model aliases", async () => {
    const dataDir = await makeDataDir();
    const createdBodies: Record<string, unknown>[] = [];
    let taskId = 0;
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === "https://upload.example/api/file-stream-upload") {
        return jsonResponse({
          code: 200,
          data: { fileUrl: "https://uploaded.example/gpt-source.png" },
        });
      }
      if (url === `${providerBaseUrl}/jobs/createTask`) {
        createdBodies.push(
          JSON.parse(String(init?.body)) as Record<string, unknown>,
        );
        return jsonResponse({
          code: 200,
          msg: "success",
          data: { taskId: `gpt-${taskId++}` },
        });
      }
      if (url.startsWith(`${providerBaseUrl}/jobs/recordInfo`)) {
        return jsonResponse({
          code: 200,
          data: {
            state: "success",
            resultJson: JSON.stringify({
              resultUrls: ["https://cdn.example/gpt.png"],
            }),
          },
        });
      }
      if (url === "https://cdn.example/gpt.png") {
        return new Response(pngBytes("gpt-png"), {
          headers: { "content-type": "image/png" },
        });
      }
      return originalFetch(input, init);
    });
    const baseUrl = await serve(
      express().use(
        createKieOpenAiRouter({
          ...resultOptions,
          apiKey: "provider-key",
          baseUrl: providerBaseUrl,
          uploadBaseUrl: "https://upload.example",
          dataDir,
          pollIntervalMs: 1,
          pollTimeoutMs: 100,
        }),
      ),
    );

    const valid = await fetch(`${baseUrl}/v1/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "gpt-valid",
      },
      body: JSON.stringify({
        model: "kie-gpt-image-2",
        prompt: "A blue kite",
        quality: "high",
        size: "16:9",
        output_format: "png",
      }),
    });
    expect(valid.status).toBe(200);
    expect(createdBodies[0]).toMatchObject({
      model: "gpt-image-2-text-to-image",
      input: { prompt: "A blue kite", aspect_ratio: "16:9", resolution: "4K" },
    });

    const editForm = new FormData();
    editForm.set("model", "kie-gpt-image-2");
    editForm.set("prompt", "Add a yellow tail");
    editForm.set("n", "1");
    editForm.set("quality", "standard");
    editForm.set("size", "1824x1024");
    editForm.set("output_format", "png");
    editForm.append(
      "image",
      new Blob([pngBytes("gpt-source")], { type: "image/png" }),
      "gpt-source.png",
    );
    const edit = await fetch(`${baseUrl}/v1/images/edits`, {
      method: "POST",
      headers: { "Idempotency-Key": "gpt-edit" },
      body: editForm,
    });
    expect(edit.status).toBe(200);
    expect(createdBodies[1]).toMatchObject({
      model: "gpt-image-2-image-to-image",
      input: {
        prompt: "Add a yellow tail",
        input_urls: ["https://uploaded.example/gpt-source.png"],
        aspect_ratio: "16:9",
        resolution: "1K",
      },
    });

    const invalid = await fetch(`${baseUrl}/v1/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "gpt-invalid",
      },
      body: JSON.stringify({ model: "gpt-image-2", prompt: "wrong alias" }),
    });
    expect(invalid.status).toBe(422);
    expect((await responseJson(invalid)).error).toMatchObject({
      code: "unsupported_model",
    });
    expect(createdBodies).toHaveLength(2);

    await rm(dataDir, { recursive: true, force: true });
  });

  test("maps rounded pixel dimensions to adapter-supported ratios", async () => {
    const dataDir = await makeDataDir();
    const createdBodies: Record<string, unknown>[] = [];
    let taskNumber = 0;
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === `${providerBaseUrl}/jobs/createTask`) {
        createdBodies.push(
          JSON.parse(String(init?.body)) as Record<string, unknown>,
        );
        return jsonResponse({
          code: 200,
          data: { taskId: `ratio-${taskNumber++}` },
        });
      }
      if (url.startsWith(`${providerBaseUrl}/jobs/recordInfo`)) {
        return jsonResponse({
          code: 200,
          data: {
            state: "success",
            resultJson: JSON.stringify({
              resultUrls: ["https://cdn.example/ratio.png"],
            }),
          },
        });
      }
      if (url === "https://cdn.example/ratio.png") {
        return new Response(pngBytes("ratio-png"), {
          headers: { "content-type": "image/png" },
        });
      }
      return originalFetch(input, init);
    });
    const baseUrl = await serve(
      express().use(
        createKieOpenAiRouter({
          ...resultOptions,
          apiKey: "provider-key",
          baseUrl: providerBaseUrl,
          dataDir,
          pollIntervalMs: 1,
          pollTimeoutMs: 100,
        }),
      ),
    );

    const cases = [
      ["kie-gpt-image-2", "1824x1024", "16:9"],
      ["kie-gpt-image-2", "2720x1536", "16:9"],
      ["kie-gpt-image-2", "3840x2160", "16:9"],
      ["kie-gpt-image-2", "1024x1824", "9:16"],
      ["kie-gpt-image-2", "1792x1024", "16:9"],
      ["kie-gpt-image-2", "1024x1792", "9:16"],
      ["kie-gpt-image-2", "1360x1024", "4:3"],
      ["kie-gpt-image-2", "1400x1024", "4:3"],
      ["kie-gpt-image-2", "1024x1360", "3:4"],
      ["kie-nano-banana-image", "1536x1024", "3:2"],
    ] as const;

    for (const [model, size, expectedRatio] of cases) {
      const response = await fetch(`${baseUrl}/v1/images/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `rounded-${model}-${size}`,
        },
        body: JSON.stringify({
          model,
          prompt: `Ratio ${size}`,
          n: 1,
          quality: "low",
          size,
          output_format: "png",
        }),
      });
      expect(response.status).toBe(200);
      expect(createdBodies.at(-1)).toMatchObject({
        input: { aspect_ratio: expectedRatio, resolution: "1K" },
      });
    }
    expect(createdBodies).toHaveLength(cases.length);

    await rm(dataDir, { recursive: true, force: true });
  });

  test("fingerprints exact and rounded representations as one image request", async () => {
    const dataDir = await makeDataDir();
    const createdBodies: Record<string, unknown>[] = [];
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === `${providerBaseUrl}/jobs/createTask`) {
        createdBodies.push(
          JSON.parse(String(init?.body)) as Record<string, unknown>,
        );
        return jsonResponse({ code: 200, data: { taskId: "equivalent-size" } });
      }
      if (url.startsWith(`${providerBaseUrl}/jobs/recordInfo`)) {
        return jsonResponse({
          code: 200,
          data: {
            state: "success",
            resultJson: JSON.stringify({
              resultUrls: ["https://cdn.example/equivalent.png"],
            }),
          },
        });
      }
      if (url === "https://cdn.example/equivalent.png") {
        return new Response(pngBytes("equivalent-png"), {
          headers: { "content-type": "image/png" },
        });
      }
      return originalFetch(input, init);
    });
    const baseUrl = await serve(
      express().use(
        createKieOpenAiRouter({
          ...resultOptions,
          apiKey: "provider-key",
          baseUrl: providerBaseUrl,
          dataDir,
          pollIntervalMs: 1,
          pollTimeoutMs: 100,
        }),
      ),
    );

    const responses: Record<string, unknown>[] = [];
    for (const size of ["1824x1024", "16:9", "2048x1152"]) {
      const response = await fetch(`${baseUrl}/v1/images/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "equivalent-size-retry",
        },
        body: JSON.stringify({
          model: "kie-gpt-image-2",
          prompt: "A cinematic landscape",
          n: 1,
          quality: "low",
          size,
          output_format: "png",
        }),
      });
      expect(response.status).toBe(200);
      responses.push(await responseJson(response));
    }
    expect(responses[1]).toEqual(responses[0]);
    expect(responses[2]).toEqual(responses[0]);
    expect(createdBodies).toHaveLength(1);
    expect(createdBodies[0]).toMatchObject({
      model: "gpt-image-2-text-to-image",
      input: {
        prompt: "A cinematic landscape",
        aspect_ratio: "16:9",
        resolution: "1K",
      },
    });

    await rm(dataDir, { recursive: true, force: true });
  });

  test("rejects unsupported ratios and malformed dimensions before paid work", async () => {
    const dataDir = await makeDataDir();
    const providerFetch = jest
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => originalFetch(input, init));
    const baseUrl = await serve(
      express().use(
        createKieOpenAiRouter({
          ...resultOptions,
          apiKey: "provider-key",
          baseUrl: providerBaseUrl,
          uploadBaseUrl: "https://upload.example",
          dataDir,
        }),
      ),
    );

    for (const size of [
      "57:32",
      "1536x1024",
      "1408x1024",
      "0x1024",
      "-1x1024",
      "wide",
      "Infinityx1024",
      `${"9".repeat(400)}x1024`,
    ]) {
      const response = await fetch(`${baseUrl}/v1/images/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `rejected-${size}`,
        },
        body: JSON.stringify({
          model: "kie-gpt-image-2",
          prompt: "Rejected size",
          size,
        }),
      });
      expect(response.status).toBe(422);
      expect((await responseJson(response)).error).toMatchObject({
        code: "unsupported_setting",
        param: "size",
      });
    }

    const editForm = new FormData();
    editForm.set("model", "kie-gpt-image-2");
    editForm.set("prompt", "Rejected edit size");
    editForm.set("size", "1408x1024");
    editForm.append(
      "image",
      new Blob([pngBytes("rejected-edit")], { type: "image/png" }),
      "rejected-edit.png",
    );
    const editResponse = await fetch(`${baseUrl}/v1/images/edits`, {
      method: "POST",
      headers: { "Idempotency-Key": "rejected-edit-size" },
      body: editForm,
    });
    expect(editResponse.status).toBe(422);
    expect((await responseJson(editResponse)).error).toMatchObject({
      code: "unsupported_setting",
      param: "size",
    });
    expect(
      providerFetch.mock.calls.some(([input]) =>
        [providerBaseUrl, "https://upload.example"].some((base) =>
          String(input).startsWith(base),
        ),
      ),
    ).toBe(false);
    expect(
      (await readdir(dataDir)).filter((name) => name.endsWith(".json")),
    ).toHaveLength(0);

    await rm(dataDir, { recursive: true, force: true });
  });

  test("normalizes Nano Banana jpeg to jpg and fingerprints the semantic format", async () => {
    const dataDir = await makeDataDir();
    const createdBodies: Record<string, unknown>[] = [];
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === `${providerBaseUrl}/jobs/createTask`) {
        createdBodies.push(
          JSON.parse(String(init?.body)) as Record<string, unknown>,
        );
        return jsonResponse({ code: 200, data: { taskId: "jpg-task" } });
      }
      if (url.startsWith(`${providerBaseUrl}/jobs/recordInfo`)) {
        return jsonResponse({
          code: 200,
          data: {
            state: "success",
            resultJson: JSON.stringify({
              resultUrls: ["https://cdn.example/result.jpg"],
            }),
          },
        });
      }
      if (url === "https://cdn.example/result.jpg") {
        return new Response(jpegBytes("jpg-result"), {
          headers: { "content-type": "image/jpeg" },
        });
      }
      return originalFetch(input, init);
    });
    const baseUrl = await serve(
      express().use(
        createKieOpenAiRouter({
          ...resultOptions,
          apiKey: "provider-key",
          baseUrl: providerBaseUrl,
          dataDir,
          pollIntervalMs: 1,
          pollTimeoutMs: 100,
        }),
      ),
    );

    const request = async (outputFormat: string) =>
      fetch(`${baseUrl}/v1/images/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "jpeg-alias",
        },
        body: JSON.stringify({
          model: "kie-nano-banana-image",
          prompt: "A photographic kite",
          output_format: outputFormat,
        }),
      });
    expect((await request("jpeg")).status).toBe(200);
    expect((await request("jpg")).status).toBe(200);
    expect(createdBodies).toHaveLength(1);
    expect(createdBodies[0]).toMatchObject({
      input: { output_format: "jpg" },
    });

    await rm(dataDir, { recursive: true, force: true });
  });

  test("rejects model-specific output formats before provider work", async () => {
    const dataDir = await makeDataDir();
    const providerCalls: string[] = [];
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (
        url.startsWith(providerBaseUrl) ||
        url.startsWith("https://upload.example")
      ) {
        providerCalls.push(url);
      }
      return originalFetch(input, init);
    });
    const baseUrl = await serve(
      express().use(
        createKieOpenAiRouter({
          ...resultOptions,
          apiKey: "provider-key",
          baseUrl: providerBaseUrl,
          uploadBaseUrl: "https://upload.example",
          dataDir,
        }),
      ),
    );

    const unsupportedNano = await fetch(`${baseUrl}/v1/images/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "kie-nano-banana-image",
        prompt: "A kite",
        output_format: "webp",
      }),
    });
    expect(unsupportedNano.status).toBe(422);
    expect((await responseJson(unsupportedNano)).error).toMatchObject({
      code: "unsupported_setting",
      param: "output_format",
    });

    const gptForm = new FormData();
    gptForm.set("model", "kie-gpt-image-2");
    gptForm.set("prompt", "Edit the kite");
    gptForm.set("output_format", "jpg");
    gptForm.append(
      "image",
      new Blob([pngBytes("source")], { type: "image/png" }),
      "source.png",
    );
    const unsupportedGpt = await fetch(`${baseUrl}/v1/images/edits`, {
      method: "POST",
      body: gptForm,
    });
    expect(unsupportedGpt.status).toBe(422);
    expect((await responseJson(unsupportedGpt)).error).toMatchObject({
      code: "unsupported_setting",
      param: "output_format",
    });
    expect(providerCalls).toHaveLength(0);
    expect(
      (await readdir(dataDir)).filter((name) => name.endsWith(".json")),
    ).toHaveLength(0);

    await rm(dataDir, { recursive: true, force: true });
  });

  test("rejects a valid provider image that does not match requested output_format", async () => {
    const dataDir = await makeDataDir();
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === `${providerBaseUrl}/jobs/createTask`) {
        return jsonResponse({ code: 200, data: { taskId: "wrong-format" } });
      }
      if (url.startsWith(`${providerBaseUrl}/jobs/recordInfo`)) {
        return jsonResponse({
          code: 200,
          data: {
            state: "success",
            resultJson: JSON.stringify({
              resultUrls: ["https://cdn.example/wrong.png"],
            }),
          },
        });
      }
      if (url === "https://cdn.example/wrong.png") {
        return new Response(pngBytes("wrong-format"), {
          headers: { "content-type": "image/png" },
        });
      }
      return originalFetch(input, init);
    });
    const baseUrl = await serve(
      express().use(
        createKieOpenAiRouter({
          ...resultOptions,
          apiKey: "provider-key",
          baseUrl: providerBaseUrl,
          dataDir,
          pollIntervalMs: 1,
          pollTimeoutMs: 100,
        }),
      ),
    );
    const response = await fetch(`${baseUrl}/v1/images/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "kie-nano-banana-image",
        prompt: "A kite",
        output_format: "jpg",
      }),
    });
    expect(response.status).toBe(502);
    expect((await responseJson(response)).error).toMatchObject({
      code: "kie_invalid_result",
    });
    await rm(dataDir, { recursive: true, force: true });
  });

  test("rejects validation and masks before reservation or provider work", async () => {
    const dataDir = await makeDataDir();
    const providerFetch = jest.spyOn(globalThis, "fetch");
    providerFetch.mockImplementation(async (input, init) =>
      originalFetch(input, init),
    );
    const baseUrl = await serve(
      express().use(
        createKieOpenAiRouter({
          ...resultOptions,
          apiKey: "provider-key",
          baseUrl: providerBaseUrl,
          dataDir,
        }),
      ),
    );

    const invalid = await fetch(`${baseUrl}/v1/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "invalid-size",
      },
      body: JSON.stringify({
        model: "kie-nano-banana-image",
        prompt: "bad ratio",
        n: 16,
        size: "7x5",
      }),
    });
    expect(invalid.status).toBe(422);
    expect((await responseJson(invalid)).error).toMatchObject({
      code: "unsupported_setting",
    });

    const form = new FormData();
    form.set("model", "kie-gpt-image-2");
    form.set("prompt", "masked edit");
    form.set("response_format", "b64_json");
    form.append(
      "image",
      new Blob(["source"], { type: "image/png" }),
      "source.png",
    );
    form.append("mask", new Blob(["mask"], { type: "image/png" }), "mask.png");
    const masked = await fetch(`${baseUrl}/v1/images/edits`, {
      method: "POST",
      headers: { "Idempotency-Key": "invalid-mask" },
      body: form,
    });
    expect(masked.status).toBe(422);
    expect((await responseJson(masked)).error).toMatchObject({
      code: "unsupported_setting",
      param: "mask",
    });
    expect(
      (await readdir(dataDir)).filter((name) => name.endsWith(".json")),
    ).toHaveLength(0);

    const transparent = await fetch(`${baseUrl}/v1/images/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "kie-nano-banana-image",
        prompt: "transparent kite",
        background: "transparent",
      }),
    });
    expect(transparent.status).toBe(422);
    expect((await responseJson(transparent)).error).toMatchObject({
      code: "unsupported_setting",
      param: "background",
    });

    await rm(dataDir, { recursive: true, force: true });
  });

  test("rejects unsupported reference MIME types and model reference limits before provider work", async () => {
    const dataDir = await makeDataDir();
    const providerCalls: string[] = [];
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.startsWith(providerBaseUrl)) providerCalls.push(url);
      return originalFetch(input, init);
    });
    const baseUrl = await serve(
      express().use(
        createKieOpenAiRouter({
          ...resultOptions,
          apiKey: "provider-key",
          baseUrl: providerBaseUrl,
          dataDir,
        }),
      ),
    );

    const tooMany = new FormData();
    tooMany.set("model", "kie-gpt-image-2");
    tooMany.set("prompt", "too many references");
    for (let index = 0; index < 17; index += 1) {
      tooMany.append(
        "image[]",
        new Blob([`image-${index}`], { type: "image/png" }),
        `image-${index}.png`,
      );
    }
    const tooManyResponse = await fetch(`${baseUrl}/v1/images/edits`, {
      method: "POST",
      headers: { "Idempotency-Key": "too-many-references" },
      body: tooMany,
    });
    expect(tooManyResponse.status).toBe(422);
    expect((await responseJson(tooManyResponse)).error).toMatchObject({
      code: "unsupported_reference",
    });

    const badMime = new FormData();
    badMime.set("model", "kie-nano-banana-image");
    badMime.set("prompt", "bad MIME");
    badMime.append(
      "image",
      new Blob(["not an image"], { type: "application/pdf" }),
      "document.pdf",
    );
    const badMimeResponse = await fetch(`${baseUrl}/v1/images/edits`, {
      method: "POST",
      headers: { "Idempotency-Key": "bad-reference-mime" },
      body: badMime,
    });
    expect(badMimeResponse.status).toBe(422);
    expect((await responseJson(badMimeResponse)).error).toMatchObject({
      code: "unsupported_reference",
    });
    expect(providerCalls).toHaveLength(0);

    await rm(dataDir, { recursive: true, force: true });
  });

  test("uploads each edit source once and maps image[] references", async () => {
    const dataDir = await makeDataDir();
    const uploads: unknown[] = [];
    const createdBodies: Record<string, unknown>[] = [];
    let taskId = 0;
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === "https://upload.example/api/file-stream-upload") {
        uploads.push(init?.body);
        return jsonResponse({
          code: 200,
          data: {
            fileUrl: `https://uploaded.example/ref-${uploads.length}.png`,
          },
        });
      }
      if (url === `${providerBaseUrl}/jobs/createTask`) {
        createdBodies.push(
          JSON.parse(String(init?.body)) as Record<string, unknown>,
        );
        return jsonResponse({
          code: 200,
          data: { taskId: `edit-${taskId++}` },
        });
      }
      if (url.startsWith(`${providerBaseUrl}/jobs/recordInfo`)) {
        return jsonResponse({
          code: 200,
          data: {
            state: "success",
            resultJson: JSON.stringify({
              resultUrls: ["https://cdn.example/edit.png"],
            }),
          },
        });
      }
      if (url === "https://cdn.example/edit.png") {
        return new Response(pngBytes("edit-png"), {
          headers: { "content-type": "image/png" },
        });
      }
      return originalFetch(input, init);
    });
    const baseUrl = await serve(
      express().use(
        createKieOpenAiRouter({
          ...resultOptions,
          apiKey: "provider-key",
          baseUrl: providerBaseUrl,
          uploadBaseUrl: "https://upload.example",
          dataDir,
          pollIntervalMs: 1,
          pollTimeoutMs: 100,
        }),
      ),
    );
    const form = new FormData();
    form.set("model", "kie-nano-banana-image");
    form.set("prompt", "combine references");
    form.set("n", "2");
    form.set("quality", "standard");
    form.set("size", "1024x1024");
    form.set("response_format", "b64_json");
    form.set("output_format", "png");
    form.append(
      "image[]",
      new Blob([pngBytes("one")], { type: "image/png" }),
      "one.png",
    );
    form.append(
      "image[]",
      new Blob([jpegBytes("two")], { type: "image/jpeg" }),
      "two.jpg",
    );

    const response = await fetch(`${baseUrl}/v1/images/edits`, {
      method: "POST",
      headers: { "Idempotency-Key": "edit-once" },
      body: form,
    });
    expect(response.status).toBe(200);
    expect(uploads).toHaveLength(2);
    expect(createdBodies).toHaveLength(2);
    expect(createdBodies[0]).toMatchObject({
      input: {
        image_input: [
          "https://uploaded.example/ref-1.png",
          "https://uploaded.example/ref-2.png",
        ],
      },
    });

    const retryForm = new FormData();
    retryForm.set("model", "kie-nano-banana-image");
    retryForm.set("prompt", "combine references");
    retryForm.set("n", "2");
    retryForm.set("quality", "standard");
    retryForm.set("size", "1024x1024");
    retryForm.set("response_format", "b64_json");
    retryForm.set("output_format", "png");
    retryForm.append(
      "image[]",
      new Blob([pngBytes("one")], { type: "image/png" }),
      "one.png",
    );
    retryForm.append(
      "image[]",
      new Blob([jpegBytes("two")], { type: "image/jpeg" }),
      "two.jpg",
    );
    const retry = await fetch(`${baseUrl}/v1/images/edits`, {
      method: "POST",
      headers: { "Idempotency-Key": "edit-once" },
      body: retryForm,
    });
    expect(retry.status).toBe(200);
    expect(uploads).toHaveLength(2);
    expect(createdBodies).toHaveLength(2);

    const mismatchForm = new FormData();
    mismatchForm.set("model", "kie-nano-banana-image");
    mismatchForm.set("prompt", "combine references");
    mismatchForm.set("n", "2");
    mismatchForm.set("quality", "standard");
    mismatchForm.set("size", "1024x1024");
    mismatchForm.set("response_format", "b64_json");
    mismatchForm.set("output_format", "png");
    mismatchForm.append(
      "image[]",
      new Blob([pngBytes("different")], { type: "image/png" }),
      "one.png",
    );
    mismatchForm.append(
      "image[]",
      new Blob([jpegBytes("two")], { type: "image/jpeg" }),
      "two.jpg",
    );
    const mismatch = await fetch(`${baseUrl}/v1/images/edits`, {
      method: "POST",
      headers: { "Idempotency-Key": "edit-once" },
      body: mismatchForm,
    });
    expect(mismatch.status).toBe(409);
    expect((await responseJson(mismatch)).error).toMatchObject({
      code: "ambiguous_submission",
    });
    expect(uploads).toHaveLength(2);

    await rm(dataDir, { recursive: true, force: true });
  });

  test("normalizes timeout and resumes a submitted request without resubmitting", async () => {
    const dataDir = await makeDataDir();
    let createCalls = 0;
    let statusCalls = 0;
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === `${providerBaseUrl}/jobs/createTask`) {
        createCalls += 1;
        return jsonResponse({ code: 200, data: { taskId: "resume-task" } });
      }
      if (url.startsWith(`${providerBaseUrl}/jobs/recordInfo`)) {
        statusCalls += 1;
        if (statusCalls === 1) {
          // Guarantee the 1ms poll deadline elapses before the second poll:
          // a fast mocked provider otherwise completes and the first response
          // flips from an expected 504 to 200 (timing flake).
          await new Promise((resolvePromise) => {
            setTimeout(resolvePromise, 25);
          });
          return jsonResponse({
            code: 200,
            data: { state: "waiting" },
          });
        }
        return jsonResponse({
          code: 200,
          data: {
            state: "success",
            resultJson: JSON.stringify({
              resultUrls: ["https://cdn.example/resume.png"],
            }),
          },
        });
      }
      if (url === "https://cdn.example/resume.png") {
        return new Response(pngBytes("resume-png"), {
          headers: { "content-type": "image/png" },
        });
      }
      return originalFetch(input, init);
    });
    const baseUrl = await serve(
      express().use(
        createKieOpenAiRouter({
          ...resultOptions,
          apiKey: "provider-key",
          baseUrl: providerBaseUrl,
          dataDir,
          pollIntervalMs: 10,
          pollTimeoutMs: 1,
        }),
      ),
    );
    const request = {
      model: "kie-gpt-image-2",
      prompt: "resume me",
      response_format: "b64_json",
    };
    const first = await fetch(`${baseUrl}/v1/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "resume-id",
      },
      body: JSON.stringify(request),
    });
    expect(first.status).toBe(504);
    expect((await responseJson(first)).error).toMatchObject({
      code: "kie_timeout",
    });

    const second = await fetch(`${baseUrl}/v1/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "resume-id",
      },
      body: JSON.stringify(request),
    });
    expect(second.status).toBe(200);
    expect(createCalls).toBe(1);
    expect((await responseJson(second)).data).toEqual([
      { b64_json: Buffer.from(pngBytes("resume-png")).toString("base64") },
    ]);

    await rm(dataDir, { recursive: true, force: true });
  });

  test("returns ambiguous_submission for a concurrent reserved duplicate", async () => {
    const dataDir = await makeDataDir();
    let createCalls = 0;
    let releaseCreate!: () => void;
    const createGate = new Promise<void>((resolvePromise) => {
      releaseCreate = resolvePromise;
    });
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === `${providerBaseUrl}/jobs/createTask`) {
        createCalls += 1;
        await createGate;
        return jsonResponse({ code: 200, data: { taskId: "only-task" } });
      }
      if (url.startsWith(`${providerBaseUrl}/jobs/recordInfo`)) {
        return jsonResponse({
          code: 200,
          data: {
            state: "success",
            resultJson: JSON.stringify({
              resultUrls: ["https://cdn.example/only.png"],
            }),
          },
        });
      }
      if (url === "https://cdn.example/only.png") {
        return new Response(pngBytes("only-png"), {
          headers: { "content-type": "image/png" },
        });
      }
      return originalFetch(input, init);
    });
    const baseUrl = await serve(
      express().use(
        createKieOpenAiRouter({
          ...resultOptions,
          apiKey: "provider-key",
          baseUrl: providerBaseUrl,
          dataDir,
          pollIntervalMs: 1,
          pollTimeoutMs: 100,
        }),
      ),
    );
    const body = JSON.stringify({
      model: "kie-gpt-image-2",
      prompt: "same request",
    });
    const headers = {
      "Content-Type": "application/json",
      "Idempotency-Key": "same-id",
    };
    const firstPromise = fetch(`${baseUrl}/v1/images/generations`, {
      method: "POST",
      headers,
      body,
    });
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 5));
    const second = await fetch(`${baseUrl}/v1/images/generations`, {
      method: "POST",
      headers,
      body,
    });
    expect(second.status).toBe(409);
    expect((await responseJson(second)).error).toMatchObject({
      code: "ambiguous_submission",
    });
    releaseCreate();
    expect((await (await firstPromise).json()).data).toBeDefined();
    expect(createCalls).toBe(1);

    await rm(dataDir, { recursive: true, force: true });
  });

  test("normalizes upstream auth failures without leaking provider details", async () => {
    const dataDir = await makeDataDir();
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === `${providerBaseUrl}/jobs/createTask`) {
        return jsonResponse(
          { code: 401, msg: "secret internal path and header" },
          401,
        );
      }
      return originalFetch(input, init);
    });
    const baseUrl = await serve(
      express().use(
        createKieOpenAiRouter({
          apiKey: "provider-key",
          baseUrl: providerBaseUrl,
          dataDir,
        }),
      ),
    );
    const response = await fetch(`${baseUrl}/v1/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "auth-failure",
      },
      body: JSON.stringify({
        model: "kie-gpt-image-2",
        prompt: "auth failure",
      }),
    });
    const body = await responseJson(response);
    expect(response.status).toBe(502);
    expect(body.error).toMatchObject({ code: "kie_upstream_auth" });
    expect(JSON.stringify(body)).not.toContain("secret internal path");

    await rm(dataDir, { recursive: true, force: true });
  });

  test("keeps mixed definite and unknown fanout failures ambiguous", async () => {
    const dataDir = await makeDataDir();
    let createCalls = 0;
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === `${providerBaseUrl}/jobs/createTask`) {
        createCalls += 1;
        if (createCalls === 1) {
          return jsonResponse({ code: 422, msg: "definite rejection" }, 422);
        }
        throw new DOMException("provider timeout", "TimeoutError");
      }
      return originalFetch(input, init);
    });
    const baseUrl = await serve(
      express().use(
        createKieOpenAiRouter({
          ...resultOptions,
          apiKey: "provider-key",
          baseUrl: providerBaseUrl,
          dataDir,
        }),
      ),
    );

    const response = await fetch(`${baseUrl}/v1/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "fanout-failure",
      },
      body: JSON.stringify({ model: "kie-gpt-image-2", prompt: "stop", n: 5 }),
    });

    expect(response.status).toBe(409);
    expect((await responseJson(response)).error).toMatchObject({
      code: "ambiguous_submission",
    });
    expect(createCalls).toBe(2);
    const records = (await readdir(dataDir)).filter((name) =>
      name.endsWith(".json"),
    );
    expect(records).toHaveLength(1);
    const record = JSON.parse(
      await readFile(`${dataDir}/${records[0]}`, "utf8"),
    ) as {
      state: string;
    };
    expect(record.state).toBe("reserved");
    await rm(dataDir, { recursive: true, force: true });
  });

  test("keeps HTTP-200 body-code 408 and 504 creations ambiguous", async () => {
    const dataDir = await makeDataDir();
    let createCalls = 0;
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === `${providerBaseUrl}/jobs/createTask`) {
        createCalls += 1;
        return jsonResponse({
          code: createCalls === 1 ? 408 : 504,
          msg: "provider creation timeout",
        });
      }
      return originalFetch(input, init);
    });
    const baseUrl = await serve(
      express().use(
        createKieOpenAiRouter({
          ...resultOptions,
          apiKey: "provider-key",
          baseUrl: providerBaseUrl,
          dataDir,
        }),
      ),
    );

    const response = await fetch(`${baseUrl}/v1/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "create-body-408",
      },
      body: JSON.stringify({ model: "kie-gpt-image-2", prompt: "wait" }),
    });

    expect(response.status).toBe(409);
    expect((await responseJson(response)).error).toMatchObject({
      code: "ambiguous_submission",
    });
    const second = await fetch(`${baseUrl}/v1/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "create-body-504",
      },
      body: JSON.stringify({ model: "kie-gpt-image-2", prompt: "wait" }),
    });
    expect(second.status).toBe(409);
    expect((await responseJson(second)).error).toMatchObject({
      code: "ambiguous_submission",
    });
    expect(createCalls).toBe(2);
    await rm(dataDir, { recursive: true, force: true });
  });

  test("normalizes HTTP-200 body-code 408 polling as a resumable timeout", async () => {
    const dataDir = await makeDataDir();
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === `${providerBaseUrl}/jobs/createTask`) {
        return jsonResponse({ code: 200, data: { taskId: "timed-out-task" } });
      }
      if (url.startsWith(`${providerBaseUrl}/jobs/recordInfo`)) {
        return jsonResponse({ code: 408, msg: "provider polling timeout" });
      }
      return originalFetch(input, init);
    });
    const baseUrl = await serve(
      express().use(
        createKieOpenAiRouter({
          ...resultOptions,
          apiKey: "provider-key",
          baseUrl: providerBaseUrl,
          dataDir,
          pollIntervalMs: 1,
          pollTimeoutMs: 100,
        }),
      ),
    );

    const response = await fetch(`${baseUrl}/v1/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "poll-408",
      },
      body: JSON.stringify({ model: "kie-gpt-image-2", prompt: "wait" }),
    });

    expect(response.status).toBe(504);
    expect((await responseJson(response)).error).toMatchObject({
      code: "kie_timeout",
    });
    await rm(dataDir, { recursive: true, force: true });
  });

  test("returns pre-reservation upload timeouts directly without a journal record", async () => {
    const dataDir = await makeDataDir();
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === "https://upload.example/api/file-stream-upload") {
        throw new DOMException("upload timeout", "TimeoutError");
      }
      return originalFetch(input, init);
    });
    const baseUrl = await serve(
      express().use(
        createKieOpenAiRouter({
          ...resultOptions,
          apiKey: "provider-key",
          baseUrl: providerBaseUrl,
          uploadBaseUrl: "https://upload.example",
          dataDir,
        }),
      ),
    );
    const form = new FormData();
    form.set("model", "kie-gpt-image-2");
    form.set("prompt", "upload timeout");
    form.append(
      "image",
      new Blob([pngBytes("source")], { type: "image/png" }),
      "source.png",
    );

    const response = await fetch(`${baseUrl}/v1/images/edits`, {
      method: "POST",
      headers: { "Idempotency-Key": "upload-timeout" },
      body: form,
    });

    expect(response.status).toBe(504);
    expect((await responseJson(response)).error).toMatchObject({
      code: "kie_timeout",
    });
    expect(
      (await readdir(dataDir)).filter((name) => name.endsWith(".json")),
    ).toHaveLength(0);
    await rm(dataDir, { recursive: true, force: true });
  });

  test("rejects unsafe and non-image provider results", async () => {
    const dataDir = await makeDataDir();
    let taskNumber = 0;
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === `${providerBaseUrl}/jobs/createTask`) {
        return jsonResponse({
          code: 200,
          data: { taskId: `result-${taskNumber++}` },
        });
      }
      if (url.startsWith(`${providerBaseUrl}/jobs/recordInfo`)) {
        const taskId = new URL(url).searchParams.get("taskId");
        return jsonResponse({
          code: 200,
          data: {
            state: "success",
            resultJson: JSON.stringify({
              resultUrls:
                taskId === "result-0"
                  ? ["https://attacker.example/result.png"]
                  : ["https://cdn.example/not-an-image.png"],
            }),
          },
        });
      }
      if (url === "https://cdn.example/not-an-image.png") {
        return new Response("not an image", {
          headers: { "content-type": "image/png" },
        });
      }
      return originalFetch(input, init);
    });
    const baseUrl = await serve(
      express().use(
        createKieOpenAiRouter({
          ...resultOptions,
          apiKey: "provider-key",
          baseUrl: providerBaseUrl,
          dataDir,
          pollIntervalMs: 1,
          pollTimeoutMs: 100,
        }),
      ),
    );

    const unsafe = await fetch(`${baseUrl}/v1/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "unsafe-result",
      },
      body: JSON.stringify({ model: "kie-gpt-image-2", prompt: "unsafe" }),
    });
    expect(unsafe.status).toBe(502);
    expect((await responseJson(unsafe)).error).toMatchObject({
      code: "kie_invalid_result",
    });

    const invalid = await fetch(`${baseUrl}/v1/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "invalid-result",
      },
      body: JSON.stringify({ model: "kie-gpt-image-2", prompt: "invalid" }),
    });
    expect(invalid.status).toBe(502);
    expect((await responseJson(invalid)).error).toMatchObject({
      code: "kie_invalid_result",
    });
    await rm(dataDir, { recursive: true, force: true });
  });

  test("maps Z-Image through its descriptor, enforces one result, and rejects unsupported settings before provider work", async () => {
    const dataDir = await makeDataDir();
    const createdBodies: Record<string, unknown>[] = [];
    let resultUrls = ["https://cdn.example/z.png"];
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === `${providerBaseUrl}/jobs/createTask`) {
        createdBodies.push(
          JSON.parse(String(init?.body)) as Record<string, unknown>,
        );
        return jsonResponse({
          code: 200,
          data: { taskId: `z-${createdBodies.length}` },
        });
      }
      if (url.startsWith(`${providerBaseUrl}/jobs/recordInfo`))
        return jsonResponse({
          code: 200,
          data: {
            state: "success",
            resultJson: JSON.stringify({
              resultUrls,
            }),
          },
        });
      if (url === "https://cdn.example/z.png")
        return new Response(pngBytes("z"), {
          status: 200,
          headers: { "content-type": "image/png" },
        });
      return originalFetch(input, init);
    });
    const baseUrl = await serve(
      express().use(
        createKieOpenAiRouter({
          ...resultOptions,
          allowedResultHostsByModel: { "kie-z-image": ["cdn.example"] },
          apiKey: "provider-key",
          baseUrl: providerBaseUrl,
          dataDir,
          pollIntervalMs: 1,
          pollTimeoutMs: 100,
        }),
      ),
    );
    const request = {
      model: "kie-z-image",
      prompt: "A bright red kite",
      size: "1024x1024",
      n: 2,
      quality: "standard",
      response_format: "b64_json",
      output_format: "png",
    };
    const response = await fetch(`${baseUrl}/v1/images/generations`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": "z-image-1",
      },
      body: JSON.stringify(request),
    });
    expect(response.status).toBe(200);
    expect((await responseJson(response)).data).toHaveLength(2);
    expect(createdBodies).toEqual(
      Array.from({ length: 2 }, () => ({
        model: "z-image",
        input: { prompt: "A bright red kite", aspect_ratio: "1:1" },
      })),
    );
    const retry = await fetch(`${baseUrl}/v1/images/generations`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": "z-image-1",
      },
      body: JSON.stringify(request),
    });
    expect(retry.status).toBe(200);
    expect(createdBodies).toHaveLength(2);
    for (const invalid of [{ quality: "hd" }, { output_format: "jpg" }]) {
      const rejected = await fetch(`${baseUrl}/v1/images/generations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...request, ...invalid }),
      });
      expect(rejected.status).toBe(422);
    }
    expect(createdBodies).toHaveLength(2);
    resultUrls = [
      "https://cdn.example/z.png",
      "https://cdn.example/z-duplicate.png",
    ];
    const multiplied = await fetch(`${baseUrl}/v1/images/generations`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": "z-image-multiple-results",
      },
      body: JSON.stringify(request),
    });
    expect(multiplied.status).toBe(502);
    expect((await responseJson(multiplied)).error).toMatchObject({
      code: "kie_invalid_result",
    });
    expect(createdBodies).toHaveLength(4);
    await rm(dataDir, { recursive: true, force: true });
  });

  test("maps exact Infinite Canvas generation payloads for every expanded image adapter", async () => {
    const dataDir = await makeDataDir();
    const submissions: Array<{ url: string; body: Record<string, unknown> }> =
      [];
    let taskNumber = 0;
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (
        url === `${providerBaseUrl}/jobs/createTask` ||
        url === `${providerBaseUrl}/flux/kontext/generate`
      ) {
        submissions.push({
          url,
          body: JSON.parse(String(init?.body)) as Record<string, unknown>,
        });
        return jsonResponse({
          code: 200,
          data: { taskId: `expanded-generation-${taskNumber++}` },
        });
      }
      if (url.startsWith(`${providerBaseUrl}/jobs/recordInfo`)) {
        const taskId = new URL(url).searchParams.get("taskId");
        return jsonResponse({
          code: 200,
          data: {
            state: "success",
            resultJson: JSON.stringify({
              resultUrls: [`https://cdn.example/${taskId}.png`],
            }),
          },
        });
      }
      if (url.startsWith(`${providerBaseUrl}/flux/kontext/record-info`)) {
        const taskId = new URL(url).searchParams.get("taskId");
        return jsonResponse({
          code: 200,
          data: {
            successFlag: 1,
            response: {
              resultImageUrl: `https://cdn.example/${taskId}.png`,
            },
          },
        });
      }
      if (url.startsWith("https://cdn.example/")) {
        return new Response(pngBytes(url), {
          headers: { "content-type": "image/png" },
        });
      }
      return originalFetch(input, init);
    });
    const baseUrl = await serve(
      express().use(
        createKieOpenAiRouter({
          ...resultOptions,
          apiKey: "provider-key",
          baseUrl: providerBaseUrl,
          dataDir,
          pollIntervalMs: 1,
          pollTimeoutMs: 100,
        }),
      ),
    );
    const models = [
      "kie-seedream-5-pro-image",
      "kie-qwen-image",
      "kie-flux-2-pro-image",
      "kie-flux-kontext-pro-image",
    ];
    for (const model of models) {
      const response = await fetch(`${baseUrl}/v1/images/generations`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Idempotency-Key": `generation-${model}`,
        },
        body: JSON.stringify({
          model,
          prompt: "A geometric botanical poster",
          n: 2,
          quality: "standard",
          size: "1024x1024",
          response_format: "b64_json",
          output_format: "png",
        }),
      });
      const body = await responseJson(response);
      if (response.status !== 200) {
        throw new Error(`${model}: ${JSON.stringify(body)}`);
      }
      expect({ model, status: response.status, body }).toMatchObject({
        model,
        status: 200,
      });
      expect(body.data).toHaveLength(2);
    }

    expect(submissions).toHaveLength(8);
    expect(submissions.map(({ url, body }) => ({ url, body }))).toEqual([
      ...Array.from({ length: 2 }, () => ({
        url: `${providerBaseUrl}/jobs/createTask`,
        body: {
          model: "seedream/5-pro-text-to-image",
          input: {
            prompt: "A geometric botanical poster",
            aspect_ratio: "1:1",
            quality: "basic",
            output_format: "png",
            nsfw_checker: false,
          },
        },
      })),
      ...Array.from({ length: 2 }, () => ({
        url: `${providerBaseUrl}/jobs/createTask`,
        body: {
          model: "qwen/text-to-image",
          input: {
            prompt: "A geometric botanical poster",
            image_size: "square_hd",
            num_inference_steps: 30,
            guidance_scale: 2.5,
            enable_safety_checker: false,
            output_format: "png",
            negative_prompt: " ",
            acceleration: "none",
          },
        },
      })),
      ...Array.from({ length: 2 }, () => ({
        url: `${providerBaseUrl}/jobs/createTask`,
        body: {
          model: "flux-2/pro-text-to-image",
          input: {
            prompt: "A geometric botanical poster",
            aspect_ratio: "1:1",
            resolution: "1K",
          },
        },
      })),
      ...Array.from({ length: 2 }, () => ({
        url: `${providerBaseUrl}/flux/kontext/generate`,
        body: {
          prompt: "A geometric botanical poster",
          enableTranslation: true,
          uploadCn: false,
          aspectRatio: "1:1",
          outputFormat: "png",
          promptUpsampling: false,
          model: "flux-kontext-pro",
          safetyTolerance: 6,
        },
      })),
    ]);
    await rm(dataDir, { recursive: true, force: true });
  });

  test("maps exact Infinite Canvas edit payloads for every expanded image adapter", async () => {
    const dataDir = await makeDataDir();
    const submissions: Array<{ url: string; body: Record<string, unknown> }> =
      [];
    let uploadNumber = 0;
    let taskNumber = 0;
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === "https://upload.example/api/file-stream-upload") {
        uploadNumber += 1;
        return jsonResponse({
          code: 200,
          data: { fileUrl: `https://uploaded.example/ref-${uploadNumber}.png` },
        });
      }
      if (
        url === `${providerBaseUrl}/jobs/createTask` ||
        url === `${providerBaseUrl}/flux/kontext/generate`
      ) {
        submissions.push({
          url,
          body: JSON.parse(String(init?.body)) as Record<string, unknown>,
        });
        return jsonResponse({
          code: 200,
          data: { taskId: `expanded-edit-${taskNumber++}` },
        });
      }
      if (url.startsWith(`${providerBaseUrl}/jobs/recordInfo`)) {
        return jsonResponse({
          code: 200,
          data: {
            state: "success",
            resultJson: JSON.stringify({
              resultUrls: ["https://cdn.example/edit.png"],
            }),
          },
        });
      }
      if (url.startsWith(`${providerBaseUrl}/flux/kontext/record-info`)) {
        return jsonResponse({
          code: 200,
          data: {
            successFlag: 1,
            response: { resultImageUrl: "https://cdn.example/edit.png" },
          },
        });
      }
      if (url === "https://cdn.example/edit.png") {
        return new Response(pngBytes("expanded-edit"), {
          headers: { "content-type": "image/png" },
        });
      }
      return originalFetch(input, init);
    });
    const baseUrl = await serve(
      express().use(
        createKieOpenAiRouter({
          ...resultOptions,
          apiKey: "provider-key",
          baseUrl: providerBaseUrl,
          uploadBaseUrl: "https://upload.example",
          dataDir,
          pollIntervalMs: 1,
          pollTimeoutMs: 100,
        }),
      ),
    );
    const models = [
      "kie-seedream-5-pro-image",
      "kie-qwen-image",
      "kie-flux-2-pro-image",
      "kie-flux-kontext-pro-image",
    ];
    for (const model of models) {
      const form = new FormData();
      form.set("model", model);
      form.set("prompt", "Turn the subject into a paper collage");
      form.set("n", "1");
      form.set("quality", "standard");
      form.set("size", "1024x1024");
      form.set("response_format", "b64_json");
      form.set("output_format", "png");
      form.append(
        "image",
        new Blob([pngBytes(model)], { type: "image/png" }),
        `${model}.png`,
      );
      const response = await fetch(`${baseUrl}/v1/images/edits`, {
        method: "POST",
        headers: { "Idempotency-Key": `edit-${model}` },
        body: form,
      });
      const body = await responseJson(response);
      if (response.status !== 200) {
        throw new Error(`${model}: ${JSON.stringify(body)}`);
      }
      expect({ model, status: response.status, body }).toMatchObject({
        model,
        status: 200,
      });
      expect(body.data).toHaveLength(1);
    }

    expect(uploadNumber).toBe(4);
    expect(submissions).toEqual([
      {
        url: `${providerBaseUrl}/jobs/createTask`,
        body: {
          model: "seedream/5-pro-image-to-image",
          input: {
            prompt: "Turn the subject into a paper collage",
            aspect_ratio: "1:1",
            quality: "basic",
            output_format: "png",
            nsfw_checker: false,
            image_urls: ["https://uploaded.example/ref-1.png"],
          },
        },
      },
      {
        url: `${providerBaseUrl}/jobs/createTask`,
        body: {
          model: "qwen/image-edit",
          input: {
            prompt: "Turn the subject into a paper collage",
            image_size: "square_hd",
            num_inference_steps: 25,
            guidance_scale: 4,
            enable_safety_checker: false,
            output_format: "png",
            negative_prompt: "blurry, ugly",
            acceleration: "none",
            image_url: "https://uploaded.example/ref-2.png",
            sync_mode: false,
          },
        },
      },
      {
        url: `${providerBaseUrl}/jobs/createTask`,
        body: {
          model: "flux-2/pro-image-to-image",
          input: {
            prompt: "Turn the subject into a paper collage",
            aspect_ratio: "1:1",
            resolution: "1K",
            input_urls: ["https://uploaded.example/ref-3.png"],
          },
        },
      },
      {
        url: `${providerBaseUrl}/flux/kontext/generate`,
        body: {
          prompt: "Turn the subject into a paper collage",
          enableTranslation: true,
          uploadCn: false,
          aspectRatio: "1:1",
          outputFormat: "png",
          promptUpsampling: false,
          model: "flux-kontext-pro",
          safetyTolerance: 2,
          inputImage: "https://uploaded.example/ref-4.png",
        },
      },
    ]);
    await rm(dataDir, { recursive: true, force: true });
  });

  test("maps and validates JPEG results for every JPEG-capable expanded adapter", async () => {
    const dataDir = await makeDataDir();
    const submissions: Array<{ url: string; body: Record<string, unknown> }> =
      [];
    let taskNumber = 0;
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (
        url === `${providerBaseUrl}/jobs/createTask` ||
        url === `${providerBaseUrl}/flux/kontext/generate`
      ) {
        submissions.push({
          url,
          body: JSON.parse(String(init?.body)) as Record<string, unknown>,
        });
        return jsonResponse({
          code: 200,
          data: { taskId: `jpeg-expanded-${taskNumber++}` },
        });
      }
      if (url.startsWith(`${providerBaseUrl}/jobs/recordInfo`)) {
        const taskId = new URL(url).searchParams.get("taskId");
        return jsonResponse({
          code: 200,
          data: {
            state: "success",
            resultJson: JSON.stringify({
              resultUrls: [`https://cdn.example/${taskId}.jpg`],
            }),
          },
        });
      }
      if (url.startsWith(`${providerBaseUrl}/flux/kontext/record-info`)) {
        const taskId = new URL(url).searchParams.get("taskId");
        return jsonResponse({
          code: 200,
          data: {
            successFlag: 1,
            response: {
              resultImageUrl: `https://cdn.example/${taskId}.jpg`,
            },
          },
        });
      }
      if (url.startsWith("https://cdn.example/") && url.endsWith(".jpg")) {
        return new Response(jpegBytes(url), {
          headers: { "content-type": "image/jpeg" },
        });
      }
      return originalFetch(input, init);
    });
    const baseUrl = await serve(
      express().use(
        createKieOpenAiRouter({
          ...resultOptions,
          apiKey: "provider-key",
          baseUrl: providerBaseUrl,
          dataDir,
          pollIntervalMs: 1,
          pollTimeoutMs: 100,
        }),
      ),
    );
    for (const model of [
      "kie-seedream-5-pro-image",
      "kie-qwen-image",
      "kie-flux-kontext-pro-image",
    ]) {
      const response = await fetch(`${baseUrl}/v1/images/generations`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Idempotency-Key": `jpeg-${model}`,
        },
        body: JSON.stringify({
          model,
          prompt: "A warm editorial portrait",
          n: 1,
          quality: "standard",
          size: "1024x1024",
          response_format: "b64_json",
          output_format: "jpeg",
        }),
      });
      expect(response.status).toBe(200);
      expect((await responseJson(response)).data).toHaveLength(1);
    }
    expect(submissions).toHaveLength(3);
    expect(submissions[0]).toMatchObject({
      body: { input: { output_format: "jpeg" } },
    });
    expect(submissions[1]).toMatchObject({
      body: { input: { output_format: "jpeg" } },
    });
    expect(submissions[2]).toMatchObject({
      body: { outputFormat: "jpeg" },
    });
    await rm(dataDir, { recursive: true, force: true });
  });

  test("rejects unsupported expanded-adapter settings and reference counts before provider work", async () => {
    const dataDir = await makeDataDir();
    const providerCalls: string[] = [];
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (
        url.startsWith(providerBaseUrl) ||
        url.startsWith("https://upload.example")
      ) {
        providerCalls.push(url);
      }
      return originalFetch(input, init);
    });
    const baseUrl = await serve(
      express().use(
        createKieOpenAiRouter({
          ...resultOptions,
          apiKey: "provider-key",
          baseUrl: providerBaseUrl,
          uploadBaseUrl: "https://upload.example",
          dataDir,
        }),
      ),
    );
    const invalidGeneration = [
      { model: "kie-seedream-5-pro-image", quality: "high" },
      { model: "kie-qwen-image", quality: "hd" },
      { model: "kie-flux-2-pro-image", quality: "high" },
      { model: "kie-flux-2-pro-image", output_format: "jpg" },
      { model: "kie-flux-kontext-pro-image", quality: "hd" },
    ];
    for (const invalid of invalidGeneration) {
      const response = await fetch(`${baseUrl}/v1/images/generations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "Unsupported setting fixture",
          n: 1,
          quality: "standard",
          size: "1024x1024",
          response_format: "b64_json",
          output_format: "png",
          ...invalid,
        }),
      });
      expect({ invalid, status: response.status }).toEqual({
        invalid,
        status: 422,
      });
    }

    const limits: Array<[string, number]> = [
      ["kie-seedream-5-pro-image", 11],
      ["kie-qwen-image", 2],
      ["kie-flux-2-pro-image", 9],
      ["kie-flux-kontext-pro-image", 2],
    ];
    for (const [model, count] of limits) {
      const form = new FormData();
      form.set("model", model);
      form.set("prompt", "Too many references");
      form.set("n", "1");
      form.set("quality", "standard");
      form.set("size", "1024x1024");
      form.set("response_format", "b64_json");
      form.set("output_format", "png");
      for (let index = 0; index < count; index += 1) {
        form.append(
          "image",
          new Blob([pngBytes(`${model}-${index}`)], { type: "image/png" }),
          `${index}.png`,
        );
      }
      const response = await fetch(`${baseUrl}/v1/images/edits`, {
        method: "POST",
        body: form,
      });
      expect(response.status).toBe(422);
    }
    expect(providerCalls).toEqual([]);
    await rm(dataDir, { recursive: true, force: true });
  });

  test("parses Flux Kontext pending, success, failure, and malformed status envelopes", async () => {
    const dataDir = await makeDataDir();
    let taskNumber = 0;
    const polls = new Map<string, number>();
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === `${providerBaseUrl}/flux/kontext/generate`) {
        return jsonResponse({
          code: 200,
          data: { taskId: `kontext-status-${taskNumber++}` },
        });
      }
      if (url.startsWith(`${providerBaseUrl}/flux/kontext/record-info`)) {
        const taskId = new URL(url).searchParams.get("taskId") ?? "";
        const count = (polls.get(taskId) ?? 0) + 1;
        polls.set(taskId, count);
        if (taskId === "kontext-status-0" && count === 1) {
          return jsonResponse({ code: 200, data: { successFlag: 0 } });
        }
        if (taskId === "kontext-status-0") {
          return jsonResponse({
            code: 200,
            data: {
              successFlag: 1,
              response: {
                resultImageUrl: "https://cdn.example/kontext-status.png",
              },
            },
          });
        }
        if (taskId === "kontext-status-1") {
          return jsonResponse({ code: 200, data: { successFlag: 3 } });
        }
        return jsonResponse({ code: 200, data: { successFlag: 1 } });
      }
      if (url === "https://cdn.example/kontext-status.png") {
        return new Response(pngBytes("kontext-status"), {
          headers: { "content-type": "image/png" },
        });
      }
      return originalFetch(input, init);
    });
    const baseUrl = await serve(
      express().use(
        createKieOpenAiRouter({
          ...resultOptions,
          apiKey: "provider-key",
          baseUrl: providerBaseUrl,
          dataDir,
          pollIntervalMs: 1,
          pollTimeoutMs: 100,
        }),
      ),
    );
    const submit = (key: string) =>
      fetch(`${baseUrl}/v1/images/generations`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Idempotency-Key": key,
        },
        body: JSON.stringify({
          model: "kie-flux-kontext-pro-image",
          prompt: "Flux Kontext status fixture",
          n: 1,
          quality: "standard",
          size: "1024x1024",
          response_format: "b64_json",
          output_format: "png",
        }),
      });

    expect((await submit("kontext-success")).status).toBe(200);
    expect((await submit("kontext-failure")).status).toBe(502);
    const malformed = await submit("kontext-malformed");
    expect(malformed.status).toBe(502);
    expect((await responseJson(malformed)).error).toMatchObject({
      code: "kie_invalid_result",
    });
    await rm(dataDir, { recursive: true, force: true });
  });
});

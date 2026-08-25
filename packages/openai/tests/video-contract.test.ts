import { once } from "node:events";
import { mkdtemp, readdir } from "node:fs/promises";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { jest } from "@jest/globals";
import express from "express";
import { createKieOpenAiRouter } from "../src/http-server.js";
import { videoRequestFingerprint } from "../src/video-adapters.js";

const providerBaseUrl = "https://provider.example/api/v1";
const resultHosts = { allowedResultHosts: ["cdn.example"] };
const phase3Models = [
  "kie-kling-3-video",
  "kie-minimax-h3-video",
  "kie-veo3-video",
  "kie-wan-2-7-video",
  "kie-happyhorse-1-0-video",
] as const;
const phase3ResultHosts = {
  allowedResultHostsByModel: Object.fromEntries(
    phase3Models.map((model) => [model, ["cdn.example"]]),
  ),
};
const originalFetch = globalThis.fetch;
const servers: Server[] = [];

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function serve(app: express.Express): Promise<string> {
  const server = app.listen(0, "127.0.0.1");
  servers.push(server);
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

async function makeDataDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "kie-openai-video-"));
}

async function responseJson(
  response: Response,
): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

function errorCode(body: Record<string, unknown>): string {
  return (body.error as Record<string, unknown>)?.code as string;
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

function mockProviderForTask(taskId: string, state = "submit") {
  const calls = {
    createBodies: [] as Record<string, unknown>[],
    uploadBodies: [] as Record<string, unknown>[],
  };
  jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/api/file-stream-upload")) {
      calls.uploadBodies.push({ url });
      return jsonResponse({
        code: 200,
        msg: "ok",
        data: {
          fileUrl: `https://upload.example/${taskId}-${calls.uploadBodies.length}`,
        },
      });
    }
    if (url === `${providerBaseUrl}/jobs/createTask`) {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      calls.createBodies.push(body);
      return jsonResponse({ code: 200, msg: "success", data: { taskId } });
    }
    if (url.startsWith(`${providerBaseUrl}/jobs/recordInfo`)) {
      return jsonResponse({ code: 200, data: { state } });
    }
    return originalFetch(input, init);
  });
  return calls;
}

describe("KIE OpenAI video contract", () => {
  test("canonical and fast aliases share the same semantic fingerprint", () => {
    const request = {
      prompt: "Alias compatibility",
      imageRefs: [],
      videoRefs: [],
      audioRefs: [],
    };
    expect(
      videoRequestFingerprint({
        ...request,
        model: "kie-bytedance-video",
      }),
    ).toBe(
      videoRequestFingerprint({
        ...request,
        model: "kie-bytedance-fast-video",
      }),
    );
  });

  test("video creation maps documented Seedance 2.5 inputs", async () => {
    const dataDir = await makeDataDir();
    const calls = mockProviderForTask("vid-1", "submit");
    const app = express();
    const router = createKieOpenAiRouter({
      apiKey: "test-key",
      baseUrl: providerBaseUrl,
      dataDir,
      ...resultHosts,
    });
    app.use(router);
    const base = await serve(app);

    const response = await fetch(`${base}/v1/videos`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": "req-1",
      },
      body: JSON.stringify({
        model: "kie-bytedance-video",
        prompt: "A cat playing piano",
        seconds: 5,
        size: "1280x720",
        resolution_name: "720p",
        generate_audio: true,
      }),
    });
    const body = await responseJson(response);
    expect(response.status).toBe(200);
    expect(body.status).toBe("pending");
    expect(body.model).toBe("kie-bytedance-video");
    expect(calls.createBodies).toHaveLength(1);
    const input = calls.createBodies[0].input as Record<string, unknown>;
    expect(input.prompt).toBe("A cat playing piano");
    expect(input.duration).toBe(5);
    expect(input.aspect_ratio).toBe("16:9");
    expect(input.resolution).toBe("720p");
    expect(input.generate_audio).toBe(true);
    router.close();
  });

  test("fast model alias routes to the fixed Seedance 2.5 model", async () => {
    const dataDir = await makeDataDir();
    const calls = mockProviderForTask("vid-2", "submit");
    const app = express();
    const router = createKieOpenAiRouter({
      apiKey: "test-key",
      baseUrl: providerBaseUrl,
      dataDir,
      ...resultHosts,
    });
    app.use(router);
    const base = await serve(app);

    await fetch(`${base}/v1/videos`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": "req-2",
      },
      body: JSON.stringify({
        model: "kie-bytedance-fast-video",
        prompt: "Fast motion test",
        seconds: 8,
        size: "720x1280",
      }),
    });
    expect(calls.createBodies[0].model).toBe("bytedance/seedance-2-5");
    expect(
      (calls.createBodies[0].input as Record<string, unknown>).aspect_ratio,
    ).toBe("9:16");
    router.close();
  });

  test("retries idempotently across canonical and fast Seedance aliases", async () => {
    const dataDir = await makeDataDir();
    const calls = mockProviderForTask("vid-alias-retry", "submit");
    const app = express();
    const router = createKieOpenAiRouter({
      apiKey: "test-key",
      baseUrl: providerBaseUrl,
      dataDir,
      ...resultHosts,
    });
    app.use(router);
    const base = await serve(app);
    const submit = (model: string) =>
      fetch(`${base}/v1/videos`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Idempotency-Key": "alias-retry",
        },
        body: JSON.stringify({
          model,
          prompt: "Equivalent alias retry",
          seconds: 5,
        }),
      });

    expect((await submit("kie-bytedance-video")).status).toBe(200);
    expect((await submit("kie-bytedance-fast-video")).status).toBe(200);
    expect(calls.createBodies).toHaveLength(1);
    router.close();
  });

  test("unsupported model is rejected", async () => {
    const dataDir = await makeDataDir();
    const app = express();
    const router = createKieOpenAiRouter({
      apiKey: "test-key",
      baseUrl: providerBaseUrl,
      dataDir,
      ...resultHosts,
    });
    app.use(router);
    const base = await serve(app);

    const response = await fetch(`${base}/v1/videos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "seedance-lite", prompt: "test" }),
    });
    const body = await responseJson(response);
    expect(response.status).toBe(422);
    expect(errorCode(body)).toBe("unsupported_model");
    router.close();
  });

  test("unsupported size is rejected", async () => {
    const dataDir = await makeDataDir();
    const app = express();
    const router = createKieOpenAiRouter({
      apiKey: "test-key",
      baseUrl: providerBaseUrl,
      dataDir,
      ...resultHosts,
    });
    app.use(router);
    const base = await serve(app);

    const response = await fetch(`${base}/v1/videos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "kie-bytedance-video",
        prompt: "test",
        size: "999x999",
      }),
    });
    expect(response.status).toBe(422);
    const body = await responseJson(response);
    expect(errorCode(body)).toBe("unsupported_setting");
    router.close();
  });

  test("does not impose undocumented duration limits", async () => {
    const dataDir = await makeDataDir();
    const calls = mockProviderForTask("vid-duration", "submit");
    const app = express();
    const router = createKieOpenAiRouter({
      apiKey: "test-key",
      baseUrl: providerBaseUrl,
      dataDir,
      ...resultHosts,
    });
    app.use(router);
    const base = await serve(app);

    const response = await fetch(`${base}/v1/videos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "kie-bytedance-video",
        prompt: "test",
        seconds: 3,
      }),
    });
    expect(response.status).toBe(200);
    expect(
      (calls.createBodies[0].input as Record<string, unknown>).duration,
    ).toBe(3);
    router.close();
  });

  test("idempotency: same key returns existing task without resubmitting", async () => {
    const dataDir = await makeDataDir();
    const calls = mockProviderForTask("vid-3", "submit");
    const app = express();
    const router = createKieOpenAiRouter({
      apiKey: "test-key",
      baseUrl: providerBaseUrl,
      dataDir,
      ...resultHosts,
    });
    app.use(router);
    const base = await serve(app);

    const body1 = JSON.stringify({
      model: "kie-bytedance-video",
      prompt: "idempotent test",
      seconds: 5,
    });
    await fetch(`${base}/v1/videos`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": "idem-1",
      },
      body: body1,
    });
    await fetch(`${base}/v1/videos`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": "idem-1",
      },
      body: body1,
    });
    expect(calls.createBodies).toHaveLength(1);
    router.close();
  });

  test("status polling maps waiting/success/failure states", async () => {
    const dataDir = await makeDataDir();
    let pollCount = 0;
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === `${providerBaseUrl}/jobs/createTask`) {
        return jsonResponse({ code: 200, data: { taskId: "vid-4" } });
      }
      if (url.startsWith(`${providerBaseUrl}/jobs/recordInfo`)) {
        pollCount += 1;
        if (pollCount < 2) {
          return jsonResponse({ code: 200, data: { state: "waiting" } });
        }
        return jsonResponse({
          code: 200,
          data: {
            state: "success",
            resultJson: JSON.stringify({
              resultUrls: ["https://cdn.example/video-4.mp4"],
            }),
          },
        });
      }
      return originalFetch(input, init);
    });

    const app = express();
    const router = createKieOpenAiRouter({
      apiKey: "test-key",
      baseUrl: providerBaseUrl,
      dataDir,
      ...resultHosts,
      pollIntervalMs: 10,
      pollTimeoutMs: 5_000,
    });
    app.use(router);
    const base = await serve(app);

    const createRes = await fetch(`${base}/v1/videos`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": "status-1",
      },
      body: JSON.stringify({
        model: "kie-bytedance-video",
        prompt: "status test",
        seconds: 5,
      }),
    });
    const created = await responseJson(createRes);
    const taskId = created.id as string;

    const statusRes = await fetch(`${base}/v1/videos/${taskId}`);
    const statusBody = await responseJson(statusRes);
    expect(statusBody.status).toBe("completed");
    router.close();
  });

  test("content route refuses pending tasks", async () => {
    const dataDir = await makeDataDir();
    mockProviderForTask("vid-5", "submit");
    const app = express();
    const router = createKieOpenAiRouter({
      apiKey: "test-key",
      baseUrl: providerBaseUrl,
      dataDir,
      ...resultHosts,
    });
    app.use(router);
    const base = await serve(app);

    const createRes = await fetch(`${base}/v1/videos`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": "content-1",
      },
      body: JSON.stringify({
        model: "kie-bytedance-video",
        prompt: "content test",
        seconds: 5,
      }),
    });
    const created = await responseJson(createRes);
    const taskId = created.id as string;

    const contentRes = await fetch(`${base}/v1/videos/${taskId}/content`);
    expect(contentRes.status).toBe(409);
    const body = await responseJson(contentRes);
    expect(errorCode(body)).toBe("task_not_ready");
    router.close();
  });

  test("content route streams completed video bytes", async () => {
    const dataDir = await makeDataDir();
    let pollCount = 0;
    const videoData = new Uint8Array([
      0x00,
      0x00,
      0x00,
      0x20,
      ...new Array(28).fill(0x66),
    ]);
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === `${providerBaseUrl}/jobs/createTask`) {
        return jsonResponse({ code: 200, data: { taskId: "vid-6" } });
      }
      if (url.startsWith(`${providerBaseUrl}/jobs/recordInfo`)) {
        pollCount += 1;
        if (pollCount < 2)
          return jsonResponse({ code: 200, data: { state: "waiting" } });
        return jsonResponse({
          code: 200,
          data: {
            state: "success",
            resultJson: JSON.stringify({
              resultUrls: ["https://cdn.example/video-6.mp4"],
            }),
          },
        });
      }
      if (url === "https://cdn.example/video-6.mp4") {
        return new Response(videoData, {
          status: 200,
          headers: { "content-type": "video/mp4" },
        });
      }
      return originalFetch(input, init);
    });

    const app = express();
    const router = createKieOpenAiRouter({
      apiKey: "test-key",
      baseUrl: providerBaseUrl,
      dataDir,
      ...resultHosts,
      pollIntervalMs: 10,
      pollTimeoutMs: 5_000,
    });
    app.use(router);
    const base = await serve(app);

    const createRes = await fetch(`${base}/v1/videos`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": "content-2",
      },
      body: JSON.stringify({
        model: "kie-bytedance-video",
        prompt: "content download test",
        seconds: 5,
      }),
    });
    const created = await responseJson(createRes);
    const taskId = created.id as string;

    await fetch(`${base}/v1/videos/${taskId}`);
    const contentRes = await fetch(`${base}/v1/videos/${taskId}/content`);
    expect(contentRes.status).toBe(200);
    expect(contentRes.headers.get("content-type")).toBe("video/mp4");
    const buffer = new Uint8Array(await contentRes.arrayBuffer());
    expect(buffer.length).toBe(videoData.length);
    router.close();
  });

  test("callback reconciliation succeeds with valid token and does not create a second task", async () => {
    const dataDir = await makeDataDir();
    let createCount = 0;
    let pollCount = 0;
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === `${providerBaseUrl}/jobs/createTask`) {
        createCount += 1;
        return jsonResponse({ code: 200, data: { taskId: "vid-7" } });
      }
      if (url.startsWith(`${providerBaseUrl}/jobs/recordInfo`)) {
        pollCount += 1;
        if (pollCount < 2)
          return jsonResponse({ code: 200, data: { state: "waiting" } });
        return jsonResponse({
          code: 200,
          data: {
            state: "success",
            resultJson: JSON.stringify({
              resultUrls: ["https://cdn.example/video-7.mp4"],
            }),
          },
        });
      }
      return originalFetch(input, init);
    });

    const app = express();
    const router = createKieOpenAiRouter({
      apiKey: "test-key",
      baseUrl: providerBaseUrl,
      dataDir,
      ...resultHosts,
      pollIntervalMs: 10,
      pollTimeoutMs: 5_000,
    });
    app.use(router);
    const base = await serve(app);

    const createRes = await fetch(`${base}/v1/videos`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": "cb-1",
      },
      body: JSON.stringify({
        model: "kie-bytedance-video",
        prompt: "callback test",
        seconds: 5,
      }),
    });
    const created = await responseJson(createRes);
    const taskId = created.id as string;

    // Read the journal record to get the callback token
    const files = await readdir(dataDir);
    const journalFile = files.find(
      (f) => f.endsWith(".json") && !f.startsWith("."),
    );
    expect(journalFile).toBeDefined();
    if (!journalFile)
      throw new Error("The request journal file was not created.");
    const journalRaw = await import("node:fs/promises").then((fs) =>
      fs.readFile(join(dataDir, journalFile), "utf8"),
    );
    const journal = JSON.parse(journalRaw) as Record<string, unknown>;
    const callbackToken = journal.callbackToken as string;
    expect(callbackToken).toBeTruthy();

    // Simulate callback with valid token
    pollCount = 0;
    const cbRes = await fetch(
      `${base}/v1/videos/${taskId}/callback?token=${callbackToken}`,
      {
        method: "POST",
      },
    );
    expect(cbRes.status).toBe(200);
    const cbBody = await responseJson(cbRes);
    expect(cbBody.ok).toBe(true);

    // Verify only one task was created
    expect(createCount).toBe(1);

    // Second callback is idempotent
    const cb2Res = await fetch(
      `${base}/v1/videos/${taskId}/callback?token=${callbackToken}`,
      {
        method: "POST",
      },
    );
    expect(cb2Res.status).toBe(200);
    expect(createCount).toBe(1);
    router.close();
  });

  test("callback rejects invalid token", async () => {
    const dataDir = await makeDataDir();
    mockProviderForTask("vid-8", "submit");
    const app = express();
    const router = createKieOpenAiRouter({
      apiKey: "test-key",
      baseUrl: providerBaseUrl,
      dataDir,
      ...resultHosts,
    });
    app.use(router);
    const base = await serve(app);

    const createRes = await fetch(`${base}/v1/videos`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": "cb-2",
      },
      body: JSON.stringify({
        model: "kie-bytedance-video",
        prompt: "callback auth test",
        seconds: 5,
      }),
    });
    const created = await responseJson(createRes);
    const taskId = created.id as string;

    const cbRes = await fetch(
      `${base}/v1/videos/${taskId}/callback?token=invalid-token`,
      {
        method: "POST",
      },
    );
    expect(cbRes.status).toBe(401);
    router.close();
  });

  test("video creation persists task and resumes after restart without resubmission", async () => {
    const dataDir = await makeDataDir();
    let createCount = 0;
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === `${providerBaseUrl}/jobs/createTask`) {
        createCount += 1;
        return jsonResponse({ code: 200, data: { taskId: "vid-9" } });
      }
      if (url.startsWith(`${providerBaseUrl}/jobs/recordInfo`)) {
        return jsonResponse({ code: 200, data: { state: "submit" } });
      }
      return originalFetch(input, init);
    });

    // First router instance creates the task
    const app1 = express();
    const router1 = createKieOpenAiRouter({
      apiKey: "test-key",
      baseUrl: providerBaseUrl,
      dataDir,
      ...resultHosts,
    });
    app1.use(router1);
    const base1 = await serve(app1);

    const createRes = await fetch(`${base1}/v1/videos`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": "restart-1",
      },
      body: JSON.stringify({
        model: "kie-bytedance-video",
        prompt: "restart test",
        seconds: 5,
      }),
    });
    const created = await responseJson(createRes);
    const taskId = created.id as string;
    router1.close();

    // Second router instance simulates restart - same data dir
    const app2 = express();
    const router2 = createKieOpenAiRouter({
      apiKey: "test-key",
      baseUrl: providerBaseUrl,
      dataDir,
      ...resultHosts,
      pollIntervalMs: 10,
      pollTimeoutMs: 100,
    });
    app2.use(router2);
    const base2 = await serve(app2);

    // Status check resumes existing task without creating a new one
    const statusRes = await fetch(`${base2}/v1/videos/${taskId}`);
    expect(statusRes.status).toBe(200);
    const statusBody = await responseJson(statusRes);
    expect(statusBody.id).toBe(taskId);
    expect(createCount).toBe(1); // no resubmission
    router2.close();
  });

  test("multipart upload maps image, video, and audio references", async () => {
    const dataDir = await makeDataDir();
    const calls = mockProviderForTask("vid-10", "submit");
    const app = express();
    const router = createKieOpenAiRouter({
      apiKey: "test-key",
      baseUrl: providerBaseUrl,
      dataDir,
      ...resultHosts,
    });
    app.use(router);
    const base = await serve(app);

    const pngBytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    const mp4Bytes = new Uint8Array([
      0x00,
      0x00,
      0x00,
      0x20,
      ...new Array(28).fill(0x61),
    ]);
    const mp3Bytes = new Uint8Array([
      0x49,
      0x44,
      0x33,
      ...new Array(100).fill(0x00),
    ]);

    const formData = new FormData();
    formData.append("model", "kie-bytedance-video");
    formData.append("prompt", "multimodal test");
    formData.append("seconds", "5");
    formData.append("size", "1280x720");
    formData.append(
      "input_reference",
      new Blob([pngBytes], { type: "image/png" }),
      "ref.png",
    );
    formData.append(
      "reference_video",
      new Blob([mp4Bytes], { type: "video/mp4" }),
      "ref.mp4",
    );
    formData.append(
      "reference_audio",
      new Blob([mp3Bytes], { type: "audio/mpeg" }),
      "ref.mp3",
    );

    const response = await fetch(`${base}/v1/videos`, {
      method: "POST",
      headers: { "Idempotency-Key": "multi-1" },
      body: formData,
    });
    expect(response.status).toBe(200);
    expect(calls.createBodies).toHaveLength(1);
    const input = calls.createBodies[0].input as Record<string, unknown>;
    expect(input.reference_image_urls).toBeDefined();
    expect(input.reference_video_urls).toBeDefined();
    expect(input.reference_audio_urls).toBeDefined();
    router.close();
  });

  test("accepts Infinite Canvas preset=normal without forwarding it and treats omission as equivalent", async () => {
    const dataDir = await makeDataDir();
    const calls = mockProviderForTask("canvas-video", "submit");
    const router = createKieOpenAiRouter({
      apiKey: "test-key",
      baseUrl: providerBaseUrl,
      uploadBaseUrl: "https://upload.example",
      dataDir,
      ...resultHosts,
    });
    const base = await serve(express().use(router));
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    const makeForm = (preset?: string): FormData => {
      const form = new FormData();
      form.set("model", "kie-bytedance-video");
      form.set("prompt", "A red kite flying over Medellin");
      form.set("seconds", "5");
      form.set("size", "1280x720");
      form.set("resolution_name", "720p");
      if (preset) form.set("preset", preset);
      form.append(
        "input_reference[]",
        new Blob([png], { type: "image/png" }),
        "first.png",
      );
      form.append(
        "input_reference[]",
        new Blob([png], { type: "image/png" }),
        "second.png",
      );
      return form;
    };

    const withPreset = await fetch(`${base}/v1/videos`, {
      method: "POST",
      headers: { "Idempotency-Key": "canvas-preset" },
      body: makeForm("normal"),
    });
    expect(withPreset.status).toBe(200);
    expect(calls.uploadBodies).toHaveLength(2);
    expect(calls.createBodies).toHaveLength(1);
    expect(calls.createBodies[0]).not.toHaveProperty("preset");
    expect(calls.createBodies[0].input).not.toHaveProperty("preset");

    const omittedPreset = await fetch(`${base}/v1/videos`, {
      method: "POST",
      headers: { "Idempotency-Key": "canvas-preset" },
      body: makeForm(),
    });
    expect(omittedPreset.status).toBe(200);
    expect(calls.uploadBodies).toHaveLength(2);
    expect(calls.createBodies).toHaveLength(1);
    router.close();
  });

  test("rejects unsupported presets before uploads, journal reservation, or provider work", async () => {
    const dataDir = await makeDataDir();
    const calls = mockProviderForTask("unsupported-preset", "submit");
    const router = createKieOpenAiRouter({
      apiKey: "test-key",
      baseUrl: providerBaseUrl,
      uploadBaseUrl: "https://upload.example",
      dataDir,
      ...resultHosts,
    });
    const base = await serve(express().use(router));
    const form = new FormData();
    form.set("model", "kie-bytedance-fast-video");
    form.set("prompt", "Unsupported preset");
    form.set("preset", "turbo");
    form.append(
      "input_reference[]",
      new Blob(
        [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
        { type: "image/png" },
      ),
      "reference.png",
    );
    const response = await fetch(`${base}/v1/videos`, {
      method: "POST",
      body: form,
    });
    expect(response.status).toBe(422);
    expect((await responseJson(response)).error).toMatchObject({
      code: "unsupported_setting",
      param: "preset",
    });
    expect(calls.uploadBodies).toHaveLength(0);
    expect(calls.createBodies).toHaveLength(0);
    expect(
      (await readdir(dataDir)).filter((name) => name.endsWith(".json")),
    ).toHaveLength(0);
    router.close();
  });

  test("callback URL is registered when callbackBaseUrl is configured", async () => {
    const dataDir = await makeDataDir();
    const calls = mockProviderForTask("vid-11", "submit");
    const app = express();
    const router = createKieOpenAiRouter({
      apiKey: "test-key",
      baseUrl: providerBaseUrl,
      dataDir,
      ...resultHosts,
      callbackBaseUrl: "https://cb.example/kie",
    });
    app.use(router);
    const base = await serve(app);

    await fetch(`${base}/v1/videos`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": "cb-url-1",
      },
      body: JSON.stringify({
        model: "kie-bytedance-video",
        prompt: "callback url test",
        seconds: 5,
      }),
    });
    expect(calls.createBodies).toHaveLength(1);
    const callBackUrl = calls.createBodies[0].callBackUrl as string;
    expect(callBackUrl).toContain("https://cb.example/kie/v1/videos/");
    expect(callBackUrl).toContain("token=");
    router.close();
  });

  test("generate_audio is preserved and removed web_search is rejected", async () => {
    const dataDir = await makeDataDir();
    const calls = mockProviderForTask("vid-12", "submit");
    const app = express();
    const router = createKieOpenAiRouter({
      apiKey: "test-key",
      baseUrl: providerBaseUrl,
      dataDir,
      ...resultHosts,
    });
    app.use(router);
    const base = await serve(app);

    const response = await fetch(`${base}/v1/videos`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": "audio-1",
      },
      body: JSON.stringify({
        model: "kie-bytedance-video",
        prompt: "audio controls test",
        seconds: 5,
        generate_audio: false,
        web_search: true,
      }),
    });
    expect(response.status).toBe(422);
    expect(calls.createBodies).toHaveLength(0);
    router.close();
  });

  test.each([
    {
      model: "kie-kling-3-video",
      body: {
        model: "kie-kling-3-video",
        prompt: "A cinematic test shot",
        seconds: 5,
        size: "1280x720",
        generate_audio: true,
        preset: "pro",
      },
      providerPath: "/jobs/createTask",
      expectedModel: "kling-3.0/video",
    },
    {
      model: "kie-minimax-h3-video",
      body: {
        model: "kie-minimax-h3-video",
        prompt: "A cinematic test shot",
        seconds: 5,
        size: "1280x720",
        preset: "text-to-video",
      },
      providerPath: "/jobs/createTask",
      expectedModel: "minimax-h3/text-to-video",
    },
    {
      model: "kie-veo3-video",
      body: {
        model: "kie-veo3-video",
        prompt: "A cinematic test shot",
        size: "1280x720",
        preset: "veo3_fast",
      },
      providerPath: "/veo/generate",
      expectedModel: "veo3_fast",
    },
    {
      model: "kie-wan-2-7-video",
      body: {
        model: "kie-wan-2-7-video",
        prompt: "A cinematic test shot",
        seconds: 5,
        size: "1280x720",
        resolution_name: "1080p",
        preset: "text-to-video",
      },
      providerPath: "/jobs/createTask",
      expectedModel: "wan/2-7-text-to-video",
    },
    {
      model: "kie-happyhorse-1-0-video",
      body: {
        model: "kie-happyhorse-1-0-video",
        prompt: "A cinematic test shot",
        seconds: 5,
        size: "1280x720",
        resolution_name: "1080p",
        preset: "text-to-video",
      },
      providerPath: "/jobs/createTask",
      expectedModel: "happyhorse/text-to-video",
    },
  ] as const)(
    "supports $model create, poll, content, and idempotency",
    async (fixture) => {
      const dataDir = await makeDataDir();
      const taskId = fixture.model;
      const createBodies: Record<string, unknown>[] = [];
      const videoData = new Uint8Array([
        0x00,
        0x00,
        0x00,
        0x20,
        ...new Array(28).fill(0x76),
      ]);
      jest
        .spyOn(globalThis, "fetch")
        .mockImplementation(async (input, init) => {
          const url = String(input);
          if (url === `${providerBaseUrl}${fixture.providerPath}`) {
            createBodies.push(
              JSON.parse(String(init?.body)) as Record<string, unknown>,
            );
            return jsonResponse({ code: 200, data: { taskId } });
          }
          if (
            url.startsWith(`${providerBaseUrl}/jobs/recordInfo`) ||
            url.startsWith(`${providerBaseUrl}/veo/record-info`)
          ) {
            return jsonResponse({
              code: 200,
              data: {
                state: "success",
                resultJson: JSON.stringify({
                  resultUrls: [`https://cdn.example/${taskId}.mp4`],
                }),
              },
            });
          }
          if (url === `https://cdn.example/${taskId}.mp4`) {
            return new Response(videoData, {
              status: 200,
              headers: { "content-type": "video/mp4" },
            });
          }
          return originalFetch(input, init);
        });

      const router = createKieOpenAiRouter({
        apiKey: "test-key",
        baseUrl: providerBaseUrl,
        dataDir,
        ...phase3ResultHosts,
        pollIntervalMs: 1,
        pollTimeoutMs: 5_000,
      });
      const base = await serve(express().use(router));
      const headers = {
        "content-type": "application/json",
        "Idempotency-Key": `phase3-${fixture.model}`,
      };
      const first = await fetch(`${base}/v1/videos`, {
        method: "POST",
        headers,
        body: JSON.stringify(fixture.body),
      });
      expect(first.status).toBe(200);
      const created = await responseJson(first);
      const taskIdFromResponse = created.id as string;
      const second = await fetch(`${base}/v1/videos`, {
        method: "POST",
        headers,
        body: JSON.stringify(fixture.body),
      });
      expect(second.status).toBe(200);
      expect(createBodies).toHaveLength(1);

      const providerBody = createBodies[0];
      if (fixture.model === "kie-veo3-video") {
        expect(providerBody.model).toBe(fixture.expectedModel);
      } else {
        expect(providerBody.model).toBe(fixture.expectedModel);
      }
      const status = await fetch(`${base}/v1/videos/${taskIdFromResponse}`);
      expect((await responseJson(status)).status).toBe("completed");
      const content = await fetch(
        `${base}/v1/videos/${taskIdFromResponse}/content`,
      );
      expect(content.status).toBe(200);
      expect(content.headers.get("content-type")).toBe("video/mp4");
      expect(new Uint8Array(await content.arrayBuffer())).toEqual(videoData);
      router.close();
    },
  );

  test("maps Midjourney image-to-video, normalizes its status, and serves content", async () => {
    const dataDir = await makeDataDir();
    const createBodies: Record<string, unknown>[] = [];
    const videoData = new Uint8Array([
      0x00,
      0x00,
      0x00,
      0x20,
      ...new Array(28).fill(0x6d),
    ]);
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/file-stream-upload")) {
        return jsonResponse({
          code: 200,
          data: { fileUrl: "https://upload.example/midjourney-reference.png" },
        });
      }
      if (url === `${providerBaseUrl}/mj/generate`) {
        createBodies.push(
          JSON.parse(String(init?.body)) as Record<string, unknown>,
        );
        return jsonResponse({ code: 200, data: { taskId: "mj-video-1" } });
      }
      if (url.startsWith(`${providerBaseUrl}/mj/record-info`)) {
        return jsonResponse({
          code: 200,
          data: {
            successFlag: 1,
            resultInfoJson: {
              resultUrls: [
                { resultUrl: "https://file.aiquickdraw.com/mj-video.mp4" },
              ],
            },
          },
        });
      }
      if (url === "https://file.aiquickdraw.com/mj-video.mp4") {
        return new Response(videoData, {
          status: 200,
          headers: { "content-type": "video/mp4" },
        });
      }
      return originalFetch(input, init);
    });

    const router = createKieOpenAiRouter({
      apiKey: "test-key",
      baseUrl: providerBaseUrl,
      uploadBaseUrl: "https://upload.example",
      dataDir,
      pollIntervalMs: 1,
      pollTimeoutMs: 5_000,
    });
    const base = await serve(express().use(router));
    const form = new FormData();
    form.set("model", "kie-midjourney-video");
    form.set("prompt", "A paper city comes alive at sunrise");
    form.set("size", "1280x720");
    form.set("preset", "normal");
    form.append(
      "input_reference",
      new Blob(
        [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
        { type: "image/png" },
      ),
      "reference.png",
    );
    const create = await fetch(`${base}/v1/videos`, {
      method: "POST",
      headers: { "Idempotency-Key": "mj-video-request" },
      body: form,
    });
    expect(create.status).toBe(200);
    expect(createBodies).toHaveLength(1);
    expect(createBodies[0]).toMatchObject({
      taskType: "mj_video",
      aspectRatio: "16:9",
      motion: "high",
      videoBatchSize: 1,
      fileUrls: ["https://upload.example/midjourney-reference.png"],
    });

    const retry = new FormData();
    retry.set("model", "kie-midjourney-video");
    retry.set("prompt", "A paper city comes alive at sunrise");
    retry.set("size", "1280x720");
    retry.set("preset", "normal");
    retry.append(
      "input_reference",
      new Blob(
        [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
        { type: "image/png" },
      ),
      "reference.png",
    );
    const retryResponse = await fetch(`${base}/v1/videos`, {
      method: "POST",
      headers: { "Idempotency-Key": "mj-video-request" },
      body: retry,
    });
    expect(retryResponse.status).toBe(200);
    expect(createBodies).toHaveLength(1);

    const id = (await responseJson(create)).id as string;
    const status = await fetch(`${base}/v1/videos/${id}`);
    expect(status.status).toBe(200);
    expect((await responseJson(status)).status).toBe("completed");
    const content = await fetch(`${base}/v1/videos/${id}/content`);
    expect(content.status).toBe(200);
    expect(new Uint8Array(await content.arrayBuffer())).toEqual(videoData);
    router.close();
  });

  test("maps Grok text/image-to-video modes and keeps normal preset compatibility", async () => {
    const dataDir = await makeDataDir();
    const createBodies: Record<string, unknown>[] = [];
    const uploadBodies: string[] = [];
    const videoData = new Uint8Array([
      0x00,
      0x00,
      0x00,
      0x20,
      ...new Array(28).fill(0x67),
    ]);
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/file-stream-upload")) {
        uploadBodies.push(url);
        return jsonResponse({
          code: 200,
          data: {
            fileUrl: `https://upload.example/grok-${uploadBodies.length}.png`,
          },
        });
      }
      if (url === `${providerBaseUrl}/jobs/createTask`) {
        createBodies.push(
          JSON.parse(String(init?.body)) as Record<string, unknown>,
        );
        return jsonResponse({
          code: 200,
          data: { taskId: `grok-video-${createBodies.length}` },
        });
      }
      if (url.startsWith(`${providerBaseUrl}/jobs/recordInfo`)) {
        return jsonResponse({
          code: 200,
          data: {
            state: "success",
            resultJson: JSON.stringify({
              resultUrls: ["https://file.aiquickdraw.com/grok-video.mp4"],
            }),
          },
        });
      }
      if (url === "https://file.aiquickdraw.com/grok-video.mp4") {
        return new Response(videoData, {
          status: 200,
          headers: { "content-type": "video/mp4" },
        });
      }
      return originalFetch(input, init);
    });

    const router = createKieOpenAiRouter({
      apiKey: "test-key",
      baseUrl: providerBaseUrl,
      uploadBaseUrl: "https://upload.example",
      dataDir,
      pollIntervalMs: 1,
      pollTimeoutMs: 5_000,
    });
    const base = await serve(express().use(router));
    const text = await fetch(`${base}/v1/videos`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": "grok-text-request",
      },
      body: JSON.stringify({
        model: "kie-grok-video",
        prompt: "A fox runs through a neon market",
        preset: "normal",
        size: "1280x720",
      }),
    });
    expect(text.status).toBe(200);
    expect(createBodies[0]).toMatchObject({
      model: "grok-imagine/text-to-video",
      input: {
        prompt: "A fox runs through a neon market",
        aspect_ratio: "16:9",
        mode: "normal",
      },
    });
    const textRecord = (await responseJson(text)).id as string;
    const retry = await fetch(`${base}/v1/videos`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": "grok-text-request",
      },
      body: JSON.stringify({
        model: "kie-grok-video",
        prompt: "A fox runs through a neon market",
        preset: "normal",
        size: "1280x720",
      }),
    });
    expect(retry.status).toBe(200);
    expect(createBodies).toHaveLength(1);
    const status = await fetch(`${base}/v1/videos/${textRecord}`);
    expect((await responseJson(status)).status).toBe("completed");
    const content = await fetch(`${base}/v1/videos/${textRecord}/content`);
    expect(content.status).toBe(200);
    expect(new Uint8Array(await content.arrayBuffer())).toEqual(videoData);

    const form = new FormData();
    form.set("model", "kie-grok-video");
    form.set("prompt", "Animate this reference gently");
    form.set("size", "1:1");
    form.append(
      "input_reference",
      new Blob(
        [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
        { type: "image/png" },
      ),
      "reference.png",
    );
    const image = await fetch(`${base}/v1/videos`, {
      method: "POST",
      headers: { "Idempotency-Key": "grok-image-request" },
      body: form,
    });
    expect(image.status).toBe(200);
    expect(createBodies[1]).toMatchObject({
      model: "grok-imagine/image-to-video",
      input: {
        image_urls: ["https://upload.example/grok-1.png"],
        prompt: "Animate this reference gently",
        mode: "normal",
      },
    });
    const imageRecord = (await responseJson(image)).id as string;
    const imageRetry = new FormData();
    imageRetry.set("model", "kie-grok-video");
    imageRetry.set("prompt", "Animate this reference gently");
    imageRetry.set("size", "1:1");
    imageRetry.append(
      "input_reference",
      new Blob(
        [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
        { type: "image/png" },
      ),
      "reference.png",
    );
    const imageRetryResponse = await fetch(`${base}/v1/videos`, {
      method: "POST",
      headers: { "Idempotency-Key": "grok-image-request" },
      body: imageRetry,
    });
    expect(imageRetryResponse.status).toBe(200);
    expect(createBodies).toHaveLength(2);
    const imageStatus = await fetch(`${base}/v1/videos/${imageRecord}`);
    expect((await responseJson(imageStatus)).status).toBe("completed");
    const imageContent = await fetch(
      `${base}/v1/videos/${imageRecord}/content`,
    );
    expect(imageContent.status).toBe(200);
    expect(new Uint8Array(await imageContent.arrayBuffer())).toEqual(videoData);
    router.close();
  });

  test.each([
    {
      name: "malformed Midjourney result entries",
      resultInfoJson: {
        resultUrls: [
          { resultUrl: "https://file.aiquickdraw.com/valid.mp4" },
          {},
        ],
      },
    },
    {
      name: "multiple Midjourney result URLs",
      resultInfoJson: {
        resultUrls: [
          { resultUrl: "https://file.aiquickdraw.com/first.mp4" },
          { resultUrl: "https://file.aiquickdraw.com/second.mp4" },
        ],
      },
    },
    {
      name: "foreign Midjourney result host",
      resultInfoJson: {
        resultUrls: [{ resultUrl: "https://foreign.example/video.mp4" }],
      },
    },
  ])("fails safely on $name", async (fixture) => {
    const dataDir = await makeDataDir();
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/file-stream-upload")) {
        return jsonResponse({
          code: 200,
          data: { fileUrl: "https://upload.example/malformed-reference.png" },
        });
      }
      if (url === `${providerBaseUrl}/mj/generate`) {
        return jsonResponse({ code: 200, data: { taskId: "mj-invalid-1" } });
      }
      if (url.startsWith(`${providerBaseUrl}/mj/record-info`)) {
        return jsonResponse({
          code: 200,
          data: { successFlag: 1, resultInfoJson: fixture.resultInfoJson },
        });
      }
      return originalFetch(input, init);
    });
    const router = createKieOpenAiRouter({
      apiKey: "test-key",
      baseUrl: providerBaseUrl,
      uploadBaseUrl: "https://upload.example",
      dataDir,
      pollIntervalMs: 1,
      pollTimeoutMs: 5_000,
    });
    const base = await serve(express().use(router));
    const form = new FormData();
    form.set("model", "kie-midjourney-video");
    form.set("prompt", "A malformed result test");
    form.append(
      "input_reference",
      new Blob(
        [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
        { type: "image/png" },
      ),
      "reference.png",
    );
    const create = await fetch(`${base}/v1/videos`, {
      method: "POST",
      body: form,
    });
    const id = (await responseJson(create)).id as string;
    const status = await fetch(`${base}/v1/videos/${id}`);
    expect(status.status).toBe(200);
    expect((await responseJson(status)).status).toBe("failed");
    router.close();
  });

  test("fails safely on a malformed Grok result", async () => {
    const dataDir = await makeDataDir();
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === `${providerBaseUrl}/jobs/createTask`) {
        return jsonResponse({ code: 200, data: { taskId: "grok-invalid-1" } });
      }
      if (url.startsWith(`${providerBaseUrl}/jobs/recordInfo`)) {
        return jsonResponse({
          code: 200,
          data: {
            state: "success",
            resultJson: JSON.stringify({ resultUrls: [{}] }),
          },
        });
      }
      return originalFetch(input, init);
    });
    const router = createKieOpenAiRouter({
      apiKey: "test-key",
      baseUrl: providerBaseUrl,
      dataDir,
      pollIntervalMs: 1,
      pollTimeoutMs: 5_000,
    });
    const base = await serve(express().use(router));
    const create = await fetch(`${base}/v1/videos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "kie-grok-video",
        prompt: "Malformed Grok result",
      }),
    });
    const id = (await responseJson(create)).id as string;
    const status = await fetch(`${base}/v1/videos/${id}`);
    expect((await responseJson(status)).status).toBe("failed");
    router.close();
  });

  test.each([
    {
      model: "kie-midjourney-video",
      operation: "image-to-video",
      providerStatus: { successFlag: 0 },
      expected: "pending",
    },
    {
      model: "kie-midjourney-video",
      operation: "image-to-video",
      providerStatus: { successFlag: 2 },
      expected: "failed",
    },
    {
      model: "kie-grok-video",
      operation: "text-to-video",
      providerStatus: { state: "waiting" },
      expected: "pending",
    },
    {
      model: "kie-grok-video",
      operation: "text-to-video",
      providerStatus: { state: "fail" },
      expected: "failed",
    },
    {
      model: "kie-grok-video",
      operation: "image-to-video",
      providerStatus: { state: "waiting" },
      expected: "pending",
    },
    {
      model: "kie-grok-video",
      operation: "image-to-video",
      providerStatus: { state: "fail" },
      expected: "failed",
    },
  ] as const)(
    "normalizes $model $operation provider status to $expected",
    async (fixture) => {
      const dataDir = await makeDataDir();
      jest
        .spyOn(globalThis, "fetch")
        .mockImplementation(async (input, _init) => {
          const url = String(input);
          if (url.includes("/api/file-stream-upload")) {
            return jsonResponse({
              code: 200,
              data: { fileUrl: "https://upload.example/phase4-status.png" },
            });
          }
          if (
            url === `${providerBaseUrl}/mj/generate` ||
            url === `${providerBaseUrl}/jobs/createTask`
          ) {
            return jsonResponse({
              code: 200,
              data: { taskId: `phase4-${fixture.model}-${fixture.expected}` },
            });
          }
          if (
            url.startsWith(`${providerBaseUrl}/mj/record-info`) ||
            url.startsWith(`${providerBaseUrl}/jobs/recordInfo`)
          ) {
            return jsonResponse({
              code: 200,
              data: fixture.providerStatus,
            });
          }
          return originalFetch(input, _init);
        });
      const router = createKieOpenAiRouter({
        apiKey: "test-key",
        baseUrl: providerBaseUrl,
        uploadBaseUrl: "https://upload.example",
        dataDir,
        pollIntervalMs: 1,
        pollTimeoutMs: 25,
      });
      const base = await serve(express().use(router));
      let body: BodyInit;
      if (fixture.operation === "text-to-video") {
        body = JSON.stringify({
          model: fixture.model,
          prompt: "Phase 4 status fixture",
        });
      } else {
        const form = new FormData();
        form.set("model", fixture.model);
        form.set("prompt", "Phase 4 status fixture");
        form.set("preset", "normal");
        form.append(
          "input_reference",
          new Blob(
            [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
            { type: "image/png" },
          ),
          "reference.png",
        );
        body = form;
      }
      const create = await fetch(`${base}/v1/videos`, {
        method: "POST",
        headers:
          fixture.operation === "text-to-video"
            ? { "content-type": "application/json" }
            : undefined,
        body,
      });
      expect(create.status).toBe(200);
      const id = (await responseJson(create)).id as string;
      const status = await fetch(`${base}/v1/videos/${id}`);
      expect((await responseJson(status)).status).toBe(fixture.expected);
      router.close();
    },
  );

  test.each([
    {
      model: "kie-midjourney-video",
      body: {
        model: "kie-midjourney-video",
        prompt: "Missing reference",
      },
    },
    {
      model: "kie-grok-video",
      body: {
        model: "kie-grok-video",
        prompt: "Unsupported preset",
        preset: "fun",
      },
    },
  ])(
    "rejects unsupported Phase 4 input before provider work for $model",
    async (fixture) => {
      const dataDir = await makeDataDir();
      const calls = mockProviderForTask(`early-${fixture.model}`, "submit");
      const router = createKieOpenAiRouter({
        apiKey: "test-key",
        baseUrl: providerBaseUrl,
        uploadBaseUrl: "https://upload.example",
        dataDir,
        allowedResultHostsByModel: {
          [fixture.model]: ["cdn.example"],
        },
      });
      const base = await serve(express().use(router));
      const response = await fetch(`${base}/v1/videos`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(fixture.body),
      });
      expect(response.status).toBe(422);
      expect(calls.createBodies).toHaveLength(0);
      expect(calls.uploadBodies).toHaveLength(0);
      expect(
        (await readdir(dataDir)).filter((name) => name.endsWith(".json")),
      ).toHaveLength(0);
      router.close();
    },
  );

  test.each([
    { model: "kie-kling-3-video", preset: undefined, field: "input_reference" },
    {
      model: "kie-minimax-h3-video",
      preset: "image-to-video",
      field: "input_reference",
    },
    { model: "kie-veo3-video", preset: undefined, field: "first_frame" },
    {
      model: "kie-wan-2-7-video",
      preset: "reference-to-video",
      field: "input_reference",
    },
    {
      model: "kie-happyhorse-1-0-video",
      preset: "reference-to-video",
      field: "input_reference[]",
    },
  ] as const)("maps reference uploads for $model", async (fixture) => {
    const dataDir = await makeDataDir();
    const uploadBodies: string[] = [];
    const createBodies: Record<string, unknown>[] = [];
    const taskId = `ref-${fixture.model}`;
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/file-stream-upload")) {
        uploadBodies.push(url);
        return jsonResponse({
          code: 200,
          data: { fileUrl: `https://upload.example/${uploadBodies.length}` },
        });
      }
      if (url.endsWith("/jobs/createTask") || url.endsWith("/veo/generate")) {
        createBodies.push(
          JSON.parse(String(init?.body)) as Record<string, unknown>,
        );
        return jsonResponse({ code: 200, data: { taskId } });
      }
      if (
        url.startsWith(`${providerBaseUrl}/jobs/recordInfo`) ||
        url.startsWith(`${providerBaseUrl}/veo/record-info`)
      ) {
        if (fixture.model === "kie-veo3-video") {
          return jsonResponse({
            code: 200,
            data: {
              successFlag: 1,
              resultUrls: JSON.stringify([`https://cdn.example/${taskId}.mp4`]),
            },
          });
        }
        return jsonResponse({
          code: 200,
          data: {
            state: "success",
            resultJson: JSON.stringify({
              resultUrls: [`https://cdn.example/${taskId}.mp4`],
            }),
          },
        });
      }
      if (url === `https://cdn.example/${taskId}.mp4`) {
        return new Response(
          new Uint8Array([0x00, 0x00, 0x00, 0x20, ...new Array(28).fill(0x66)]),
          { status: 200, headers: { "content-type": "video/mp4" } },
        );
      }
      return originalFetch(input, init);
    });
    const router = createKieOpenAiRouter({
      apiKey: "test-key",
      baseUrl: providerBaseUrl,
      dataDir,
      uploadBaseUrl: "https://upload.example",
      ...phase3ResultHosts,
    });
    const base = await serve(express().use(router));
    const form = new FormData();
    form.set("model", fixture.model);
    form.set("prompt", "Reference upload test");
    if (fixture.model !== "kie-veo3-video") form.set("seconds", "5");
    if (fixture.model !== "kie-minimax-h3-video") {
      form.set("size", "1280x720");
    }
    if (fixture.preset) form.set("preset", fixture.preset);
    const image = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    form.append(
      fixture.field,
      new Blob([image], { type: "image/png" }),
      "ref.png",
    );
    if (fixture.model === "kie-wan-2-7-video") {
      const video = new Uint8Array([
        0x00,
        0x00,
        0x00,
        0x20,
        ...new Array(28).fill(0x66),
      ]);
      form.append(
        "reference_video",
        new Blob([video], { type: "video/mp4" }),
        "ref.mp4",
      );
    }
    const response = await fetch(`${base}/v1/videos`, {
      method: "POST",
      headers: { "Idempotency-Key": `ref-${fixture.model}` },
      body: form,
    });
    expect(response.status).toBe(200);
    expect(uploadBodies.length).toBeGreaterThan(0);
    expect(createBodies).toHaveLength(1);
    router.close();
  });

  test("rejects adapter-incompatible references before upload and reservation", async () => {
    const dataDir = await makeDataDir();
    const calls = mockProviderForTask("phase3-early", "submit");
    const router = createKieOpenAiRouter({
      apiKey: "test-key",
      baseUrl: providerBaseUrl,
      dataDir,
      uploadBaseUrl: "https://upload.example",
      ...phase3ResultHosts,
    });
    const base = await serve(express().use(router));
    const form = new FormData();
    form.set("model", "kie-kling-3-video");
    form.set("prompt", "This must fail before paid work");
    form.append(
      "reference_video",
      new Blob(
        [new Uint8Array([0x00, 0x00, 0x00, 0x20, ...new Array(28).fill(0x66)])],
        {
          type: "video/mp4",
        },
      ),
      "ref.mp4",
    );
    const response = await fetch(`${base}/v1/videos`, {
      method: "POST",
      body: form,
    });
    expect(response.status).toBe(422);
    expect(errorCode(await responseJson(response))).toBe("unsupported_setting");
    expect(calls.uploadBodies).toHaveLength(0);
    expect(calls.createBodies).toHaveLength(0);
    expect(
      (await readdir(dataDir)).filter((name) => name.endsWith(".json")),
    ).toHaveLength(0);
    router.close();
  });

  test("unconfigured server returns 503 on video routes", async () => {
    const dataDir = await makeDataDir();
    const app = express();
    const router = createKieOpenAiRouter({
      apiKey: "",
      dataDir,
      ...resultHosts,
    });
    app.use(router);
    const base = await serve(app);

    const response = await fetch(`${base}/v1/videos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "kie-bytedance-video",
        prompt: "test",
        seconds: 5,
      }),
    });
    expect(response.status).toBe(503);
    const body = await responseJson(response);
    expect(errorCode(body)).toBe("kie_unconfigured");
    router.close();
  });

  test("provider failure maps to failed status", async () => {
    const dataDir = await makeDataDir();
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === `${providerBaseUrl}/jobs/createTask`) {
        return jsonResponse({ code: 200, data: { taskId: "vid-13" } });
      }
      if (url.startsWith(`${providerBaseUrl}/jobs/recordInfo`)) {
        return jsonResponse({ code: 200, data: { state: "fail" } });
      }
      return originalFetch(input, init);
    });

    const app = express();
    const router = createKieOpenAiRouter({
      apiKey: "test-key",
      baseUrl: providerBaseUrl,
      dataDir,
      ...resultHosts,
      pollIntervalMs: 10,
      pollTimeoutMs: 5_000,
    });
    app.use(router);
    const base = await serve(app);

    const createRes = await fetch(`${base}/v1/videos`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": "fail-1",
      },
      body: JSON.stringify({
        model: "kie-bytedance-video",
        prompt: "failure test",
        seconds: 5,
      }),
    });
    const created = await responseJson(createRes);
    const taskId = created.id as string;

    const statusRes = await fetch(`${base}/v1/videos/${taskId}`);
    const statusBody = await responseJson(statusRes);
    expect(statusBody.status).toBe("failed");
    router.close();
  });
});

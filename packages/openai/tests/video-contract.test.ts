import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { jest } from "@jest/globals";
import { createHash } from "node:crypto";
import { createKieOpenAiRouter } from "../src/http-server.js";

const providerBaseUrl = "https://provider.example/api/v1";
const resultHosts = { allowedResultHosts: ["cdn.example"] };
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

async function responseJson(response: Response): Promise<Record<string, unknown>> {
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
  const calls = { createBodies: [] as Record<string, unknown>[], uploadBodies: [] as Record<string, unknown>[] };
  jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/api/file-stream-upload")) {
      calls.uploadBodies.push({ url });
      return jsonResponse({ code: 200, msg: "ok", data: { fileUrl: `https://upload.example/${taskId}-${calls.uploadBodies.length}` } });
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
  test("video creation maps model, prompt, seconds, size, resolution, and audio controls", async () => {
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
      headers: { "content-type": "application/json", "Idempotency-Key": "req-1" },
      body: JSON.stringify({
        model: "kie-bytedance-video",
        prompt: "A cat playing piano",
        seconds: 5,
        size: "1280x720",
        resolution_name: "720p",
        preset: "normal",
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

  test("fast model alias selects fast mode", async () => {
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
      headers: { "content-type": "application/json", "Idempotency-Key": "req-2" },
      body: JSON.stringify({
        model: "kie-bytedance-fast-video",
        prompt: "Fast motion test",
        seconds: 8,
        size: "720x1280",
      }),
    });
    expect(calls.createBodies[0].model).toBe("bytedance/seedance-2-fast");
    expect((calls.createBodies[0].input as Record<string, unknown>).aspect_ratio).toBe("9:16");
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

  test("duration outside 4-15 is rejected", async () => {
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
        seconds: 3,
      }),
    });
    expect(response.status).toBe(422);
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
      headers: { "content-type": "application/json", "Idempotency-Key": "idem-1" },
      body: body1,
    });
    await fetch(`${base}/v1/videos`, {
      method: "POST",
      headers: { "content-type": "application/json", "Idempotency-Key": "idem-1" },
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
            resultJson: JSON.stringify({ resultUrls: ["https://cdn.example/video-4.mp4"] }),
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
      headers: { "content-type": "application/json", "Idempotency-Key": "status-1" },
      body: JSON.stringify({ model: "kie-bytedance-video", prompt: "status test", seconds: 5 }),
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
      headers: { "content-type": "application/json", "Idempotency-Key": "content-1" },
      body: JSON.stringify({ model: "kie-bytedance-video", prompt: "content test", seconds: 5 }),
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
    const videoData = new Uint8Array([0x00, 0x00, 0x00, 0x20, ...new Array(28).fill(0x66)]);
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === `${providerBaseUrl}/jobs/createTask`) {
        return jsonResponse({ code: 200, data: { taskId: "vid-6" } });
      }
      if (url.startsWith(`${providerBaseUrl}/jobs/recordInfo`)) {
        pollCount += 1;
        if (pollCount < 2) return jsonResponse({ code: 200, data: { state: "waiting" } });
        return jsonResponse({
          code: 200,
          data: { state: "success", resultJson: JSON.stringify({ resultUrls: ["https://cdn.example/video-6.mp4"] }) },
        });
      }
      if (url === "https://cdn.example/video-6.mp4") {
        return new Response(videoData, { status: 200, headers: { "content-type": "video/mp4" } });
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
      headers: { "content-type": "application/json", "Idempotency-Key": "content-2" },
      body: JSON.stringify({ model: "kie-bytedance-video", prompt: "content download test", seconds: 5 }),
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
        if (pollCount < 2) return jsonResponse({ code: 200, data: { state: "waiting" } });
        return jsonResponse({
          code: 200,
          data: { state: "success", resultJson: JSON.stringify({ resultUrls: ["https://cdn.example/video-7.mp4"] }) },
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
      headers: { "content-type": "application/json", "Idempotency-Key": "cb-1" },
      body: JSON.stringify({ model: "kie-bytedance-video", prompt: "callback test", seconds: 5 }),
    });
    const created = await responseJson(createRes);
    const taskId = created.id as string;

    // Read the journal record to get the callback token
    const files = await readdir(dataDir);
    const journalFile = files.find((f) => f.endsWith(".json") && !f.startsWith("."));
    expect(journalFile).toBeDefined();
    const journalRaw = await import("node:fs/promises").then((fs) => fs.readFile(join(dataDir, journalFile!), "utf8"));
    const journal = JSON.parse(journalRaw) as Record<string, unknown>;
    const callbackToken = journal.callbackToken as string;
    expect(callbackToken).toBeTruthy();

    // Simulate callback with valid token
    pollCount = 0;
    const cbRes = await fetch(`${base}/v1/videos/${taskId}/callback?token=${callbackToken}`, {
      method: "POST",
    });
    expect(cbRes.status).toBe(200);
    const cbBody = await responseJson(cbRes);
    expect(cbBody.ok).toBe(true);

    // Verify only one task was created
    expect(createCount).toBe(1);

    // Second callback is idempotent
    const cb2Res = await fetch(`${base}/v1/videos/${taskId}/callback?token=${callbackToken}`, {
      method: "POST",
    });
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
      headers: { "content-type": "application/json", "Idempotency-Key": "cb-2" },
      body: JSON.stringify({ model: "kie-bytedance-video", prompt: "callback auth test", seconds: 5 }),
    });
    const created = await responseJson(createRes);
    const taskId = created.id as string;

    const cbRes = await fetch(`${base}/v1/videos/${taskId}/callback?token=invalid-token`, {
      method: "POST",
    });
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
      headers: { "content-type": "application/json", "Idempotency-Key": "restart-1" },
      body: JSON.stringify({ model: "kie-bytedance-video", prompt: "restart test", seconds: 5 }),
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

    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const mp4Bytes = new Uint8Array([0x00, 0x00, 0x00, 0x20, ...new Array(28).fill(0x61)]);
    const mp3Bytes = new Uint8Array([0x49, 0x44, 0x33, ...new Array(100).fill(0x00)]);

    const formData = new FormData();
    formData.append("model", "kie-bytedance-video");
    formData.append("prompt", "multimodal test");
    formData.append("seconds", "5");
    formData.append("size", "1280x720");
    formData.append("input_reference", new Blob([pngBytes], { type: "image/png" }), "ref.png");
    formData.append("reference_video", new Blob([mp4Bytes], { type: "video/mp4" }), "ref.mp4");
    formData.append("reference_audio", new Blob([mp3Bytes], { type: "audio/mpeg" }), "ref.mp3");

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
      headers: { "content-type": "application/json", "Idempotency-Key": "cb-url-1" },
      body: JSON.stringify({ model: "kie-bytedance-video", prompt: "callback url test", seconds: 5 }),
    });
    expect(calls.createBodies).toHaveLength(1);
    const callBackUrl = calls.createBodies[0].callBackUrl as string;
    expect(callBackUrl).toContain("https://cb.example/kie/v1/videos/");
    expect(callBackUrl).toContain("token=");
    router.close();
  });

  test("web_search and generate_audio are preserved in provider payload", async () => {
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

    await fetch(`${base}/v1/videos`, {
      method: "POST",
      headers: { "content-type": "application/json", "Idempotency-Key": "audio-1" },
      body: JSON.stringify({
        model: "kie-bytedance-video",
        prompt: "audio controls test",
        seconds: 5,
        generate_audio: false,
        web_search: true,
      }),
    });
    const input = calls.createBodies[0].input as Record<string, unknown>;
    expect(input.generate_audio).toBe(false);
    expect(input.web_search).toBe(true);
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
      body: JSON.stringify({ model: "kie-bytedance-video", prompt: "test", seconds: 5 }),
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
      headers: { "content-type": "application/json", "Idempotency-Key": "fail-1" },
      body: JSON.stringify({ model: "kie-bytedance-video", prompt: "failure test", seconds: 5 }),
    });
    const created = await responseJson(createRes);
    const taskId = created.id as string;

    const statusRes = await fetch(`${base}/v1/videos/${taskId}`);
    const statusBody = await responseJson(statusRes);
    expect(statusBody.status).toBe("failed");
    router.close();
  });
});

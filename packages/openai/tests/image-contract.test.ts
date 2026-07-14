import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { jest } from "@jest/globals";
import { createKieOpenAiRouter } from "../src/http-server.js";

const providerBaseUrl = "https://provider.example/api/v1";
const resultOptions = { allowedResultHosts: ["cdn.example"] };
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

async function responseJson(response: Response): Promise<Record<string, unknown>> {
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
        activeCreates.maximum = Math.max(activeCreates.maximum, activeCreates.value);
        createdBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
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
            resultJson: JSON.stringify({ resultUrls: [`https://cdn.example/${taskId}.png`] }),
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
      if (url === `${providerBaseUrl}/jobs/createTask`) {
        createdBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        return jsonResponse({ code: 200, msg: "success", data: { taskId: `gpt-${taskId++}` } });
      }
      if (url.startsWith(`${providerBaseUrl}/jobs/recordInfo`)) {
        return jsonResponse({
          code: 200,
          data: {
            state: "success",
            resultJson: JSON.stringify({ resultUrls: ["https://cdn.example/gpt.png"] }),
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
          dataDir,
          pollIntervalMs: 1,
          pollTimeoutMs: 100,
        }),
      ),
    );

    const valid = await fetch(`${baseUrl}/v1/images/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": "gpt-valid" },
      body: JSON.stringify({
        model: "kie-gpt-image-2",
        prompt: "A blue kite",
        quality: "high",
        size: "16:9",
        response_format: "b64_json",
      }),
    });
    expect(valid.status).toBe(200);
    expect(createdBodies[0]).toMatchObject({
      model: "gpt-image-2-text-to-image",
      input: { prompt: "A blue kite", aspect_ratio: "16:9", resolution: "4K" },
    });

    const invalid = await fetch(`${baseUrl}/v1/images/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": "gpt-invalid" },
      body: JSON.stringify({ model: "gpt-image-2", prompt: "wrong alias" }),
    });
    expect(invalid.status).toBe(422);
    expect((await responseJson(invalid)).error).toMatchObject({ code: "unsupported_model" });
    expect(createdBodies).toHaveLength(1);

    await rm(dataDir, { recursive: true, force: true });
  });

  test("rejects validation and masks before reservation or provider work", async () => {
    const dataDir = await makeDataDir();
    const providerFetch = jest.spyOn(globalThis, "fetch");
    providerFetch.mockImplementation(async (input, init) => originalFetch(input, init));
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
      headers: { "Content-Type": "application/json", "Idempotency-Key": "invalid-size" },
      body: JSON.stringify({
        model: "kie-nano-banana-image",
        prompt: "bad ratio",
        n: 16,
        size: "7x5",
      }),
    });
    expect(invalid.status).toBe(422);
    expect((await responseJson(invalid)).error).toMatchObject({ code: "unsupported_setting" });

    const form = new FormData();
    form.set("model", "kie-gpt-image-2");
    form.set("prompt", "masked edit");
    form.set("response_format", "b64_json");
    form.append("image", new Blob(["source"], { type: "image/png" }), "source.png");
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
          data: { fileUrl: `https://uploaded.example/ref-${uploads.length}.png` },
        });
      }
      if (url === `${providerBaseUrl}/jobs/createTask`) {
        createdBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        return jsonResponse({ code: 200, data: { taskId: `edit-${taskId++}` } });
      }
      if (url.startsWith(`${providerBaseUrl}/jobs/recordInfo`)) {
        return jsonResponse({
          code: 200,
          data: {
            state: "success",
            resultJson: JSON.stringify({ resultUrls: ["https://cdn.example/edit.png"] }),
          },
        });
      }
      if (url === "https://cdn.example/edit.png") {
        return new Response(pngBytes("edit-png"), { headers: { "content-type": "image/png" } });
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
    form.append("image[]", new Blob([pngBytes("one")], { type: "image/png" }), "one.png");
    form.append("image[]", new Blob([jpegBytes("two")], { type: "image/jpeg" }), "two.jpg");

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
    retryForm.append("image[]", new Blob([pngBytes("one")], { type: "image/png" }), "one.png");
    retryForm.append("image[]", new Blob([jpegBytes("two")], { type: "image/jpeg" }), "two.jpg");
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
    mismatchForm.append("image[]", new Blob([pngBytes("different")], { type: "image/png" }), "one.png");
    mismatchForm.append("image[]", new Blob([jpegBytes("two")], { type: "image/jpeg" }), "two.jpg");
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
        return jsonResponse({
          code: 200,
          data:
            statusCalls === 1
              ? { state: "waiting" }
              : {
                  state: "success",
                  resultJson: JSON.stringify({ resultUrls: ["https://cdn.example/resume.png"] }),
                },
        });
      }
      if (url === "https://cdn.example/resume.png") {
        return new Response(pngBytes("resume-png"), { headers: { "content-type": "image/png" } });
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
      headers: { "Content-Type": "application/json", "Idempotency-Key": "resume-id" },
      body: JSON.stringify(request),
    });
    expect(first.status).toBe(504);
    expect((await responseJson(first)).error).toMatchObject({ code: "kie_timeout" });

    const second = await fetch(`${baseUrl}/v1/images/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": "resume-id" },
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
            resultJson: JSON.stringify({ resultUrls: ["https://cdn.example/only.png"] }),
          },
        });
      }
      if (url === "https://cdn.example/only.png") {
        return new Response(pngBytes("only-png"), { headers: { "content-type": "image/png" } });
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
    const body = JSON.stringify({ model: "kie-gpt-image-2", prompt: "same request" });
    const headers = { "Content-Type": "application/json", "Idempotency-Key": "same-id" };
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
    expect((await responseJson(second)).error).toMatchObject({ code: "ambiguous_submission" });
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
        return jsonResponse({ code: 401, msg: "secret internal path and header" }, 401);
      }
      return originalFetch(input, init);
    });
    const baseUrl = await serve(
      express().use(
        createKieOpenAiRouter({ apiKey: "provider-key", baseUrl: providerBaseUrl, dataDir }),
      ),
    );
    const response = await fetch(`${baseUrl}/v1/images/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": "auth-failure" },
      body: JSON.stringify({ model: "kie-gpt-image-2", prompt: "auth failure" }),
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
      headers: { "Content-Type": "application/json", "Idempotency-Key": "fanout-failure" },
      body: JSON.stringify({ model: "kie-gpt-image-2", prompt: "stop", n: 5 }),
    });

    expect(response.status).toBe(409);
    expect((await responseJson(response)).error).toMatchObject({
      code: "ambiguous_submission",
    });
    expect(createCalls).toBe(2);
    const records = (await readdir(dataDir)).filter((name) => name.endsWith(".json"));
    expect(records).toHaveLength(1);
    const record = JSON.parse(await readFile(`${dataDir}/${records[0]}`, "utf8")) as {
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
      headers: { "Content-Type": "application/json", "Idempotency-Key": "create-body-408" },
      body: JSON.stringify({ model: "kie-gpt-image-2", prompt: "wait" }),
    });

    expect(response.status).toBe(409);
    expect((await responseJson(response)).error).toMatchObject({
      code: "ambiguous_submission",
    });
    const second = await fetch(`${baseUrl}/v1/images/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": "create-body-504" },
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
      headers: { "Content-Type": "application/json", "Idempotency-Key": "poll-408" },
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
    form.append("image", new Blob([pngBytes("source")], { type: "image/png" }), "source.png");

    const response = await fetch(`${baseUrl}/v1/images/edits`, {
      method: "POST",
      headers: { "Idempotency-Key": "upload-timeout" },
      body: form,
    });

    expect(response.status).toBe(504);
    expect((await responseJson(response)).error).toMatchObject({
      code: "kie_timeout",
    });
    expect((await readdir(dataDir)).filter((name) => name.endsWith(".json"))).toHaveLength(0);
    await rm(dataDir, { recursive: true, force: true });
  });

  test("rejects unsafe and non-image provider results", async () => {
    const dataDir = await makeDataDir();
    let taskNumber = 0;
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === `${providerBaseUrl}/jobs/createTask`) {
        return jsonResponse({ code: 200, data: { taskId: `result-${taskNumber++}` } });
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
      headers: { "Content-Type": "application/json", "Idempotency-Key": "unsafe-result" },
      body: JSON.stringify({ model: "kie-gpt-image-2", prompt: "unsafe" }),
    });
    expect(unsafe.status).toBe(502);
    expect((await responseJson(unsafe)).error).toMatchObject({
      code: "kie_invalid_result",
    });

    const invalid = await fetch(`${baseUrl}/v1/images/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": "invalid-result" },
      body: JSON.stringify({ model: "kie-gpt-image-2", prompt: "invalid" }),
    });
    expect(invalid.status).toBe(502);
    expect((await responseJson(invalid)).error).toMatchObject({
      code: "kie_invalid_result",
    });
    await rm(dataDir, { recursive: true, force: true });
  });
});

import { mkdir, mkdtemp, readdir, rm, utimes, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { afterEach, describe, expect, test } from "@jest/globals";
import { createHttpApp } from "../http-transport.js";
import { TemporaryUploadStore } from "../upload-storage.js";
import { getUploadUrlTool } from "@felores/kie-ai-core";
import type { ToolContext } from "@felores/kie-ai-core";

const roots: string[] = [];
const stores: TemporaryUploadStore[] = [];

afterEach(async () => {
  await Promise.all(stores.splice(0).map((store) => store.close()));
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

function pngBytes(): Uint8Array {
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
  ]);
}

function uploadBody(): BodyInit {
  return Buffer.from(pngBytes()) as unknown as BodyInit;
}

function rawPut(
  url: string,
  headers: Record<string, string>,
  body: Uint8Array,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const request = httpRequest(
      {
        hostname: target.hostname,
        port: target.port,
        path: target.pathname,
        method: "PUT",
        headers,
      },
      (response) => {
        response.resume();
        response.once("end", () => resolve(response.statusCode ?? 0));
      },
    );
    request.once("error", reject);
    request.write(Buffer.from(body));
    request.end();
  });
}

function stalledPut(url: string, body: Uint8Array): Promise<void> {
  return new Promise((resolve) => {
    const target = new URL(url);
    const request = httpRequest(
      {
        hostname: target.hostname,
        port: target.port,
        path: target.pathname,
        method: "PUT",
        headers: { "Content-Type": "image/png" },
      },
      (response) => {
        response.resume();
        response.once("end", resolve);
      },
    );
    request.once("error", () => resolve());
    request.write(Buffer.from(body.subarray(0, 1)));
  });
}

async function createStore(
  overrides: Partial<ConstructorParameters<typeof TemporaryUploadStore>[0]> = {},
): Promise<TemporaryUploadStore> {
  const root = await mkdtemp(join(tmpdir(), "kie-upload-test-"));
  roots.push(root);
  const store = new TemporaryUploadStore({
    publicBaseUrl: "http://127.0.0.1",
    storageRoot: root,
    ...overrides,
  });
  stores.push(store);
  return store;
}

function toolContext(store: TemporaryUploadStore): ToolContext {
  return {
    client: {} as ToolContext["client"],
    db: {} as ToolContext["db"],
    approvalContext: "owner-1",
    getCallbackUrl: (value) => value ?? "",
    formatError: (_name, error) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      ],
    }),
    getTool: () => undefined,
    createWidgetGrant: () => "g".repeat(43),
    validateWidgetGrant: () => true,
    createUploadCapability: (request) => store.createCapability(request),
  };
}

async function listen(store: TemporaryUploadStore): Promise<{
  origin: string;
  close: () => Promise<void>;
}> {
  const app = createHttpApp({
    createServer: () =>
      new Server(
        { name: "test", version: "1" },
        { capabilities: { tools: {} } },
      ),
    version: "test",
    uploadStore: store,
    host: "127.0.0.1",
    port: 0,
    token: "mcp-secret",
    allowedHosts: ["127.0.0.1"],
    allowedOrigins: ["https://host.example"],
    uploadAllowedOrigins: ["https://sandbox.example"],
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

describe("temporary upload primary path", () => {
  test("mints through the MCP tool, streams PUT, and serves bounded GET/HEAD", async () => {
    const store = await createStore();
    const runtime = await listen(store);
    try {
      const toolResult = await getUploadUrlTool.run(
        {
          app_grant: "g".repeat(43),
          filename: "reference.png",
          content_type: "image/png",
          size: pngBytes().length,
        },
        toolContext(store),
      );
      const minted = JSON.parse(toolResult.content[0].text) as {
        media_id: string;
      };
      const privateUpload = toolResult._meta?.upload as {
        upload_url: string;
      };
      const uploadPath = new URL(privateUpload.upload_url).pathname;

      const put = await fetch(runtime.origin + uploadPath, {
        method: "PUT",
        headers: {
          Origin: "https://sandbox.example",
          "Content-Type": "image/png",
          "Content-Length": String(pngBytes().length),
        },
        body: uploadBody(),
      });
      expect(put.status).toBe(201);
      expect(put.headers.get("access-control-allow-origin")).toBe(
        "https://sandbox.example",
      );

      const providerDownload = await store.createProviderDownload({
        mediaId: minted.media_id,
        owner: "owner-1",
      });
      const downloadPath = new URL(providerDownload.url).pathname;
      const head = await fetch(runtime.origin + downloadPath, { method: "HEAD" });
      expect(head.status).toBe(200);
      expect(head.headers.get("x-content-type-options")).toBe("nosniff");
      expect(head.headers.get("cache-control")).toBe("private, no-store");

      const get = await fetch(runtime.origin + downloadPath);
      expect(get.status).toBe(200);
      expect(new Uint8Array(await get.arrayBuffer())).toEqual(pngBytes());
      expect(get.headers.get("content-disposition")).toContain("reference.png");

      const replay = await fetch(runtime.origin + uploadPath, {
        method: "PUT",
        headers: { "Content-Type": "image/png" },
        body: uploadBody(),
      });
      expect(replay.status).toBe(404);
    } finally {
      await runtime.close();
    }
  });

  test("rejects bad Origin, Host, and unauthenticated MCP mutation", async () => {
    const store = await createStore();
    const capability = await store.createCapability({
      owner: "owner-1",
      filename: "reference.png",
      contentType: "image/png",
      size: pngBytes().length,
    });
    const runtime = await listen(store);
    try {
      const path = new URL(capability.uploadUrl).pathname;
      expect(
        (
          await fetch(runtime.origin + path, {
            method: "PUT",
            headers: {
              Origin: "https://evil.example",
              "Content-Type": "image/png",
            },
            body: uploadBody(),
          })
        ).status,
      ).toBe(403);
      expect(
        await rawPut(
          runtime.origin + path,
          { Host: "evil.example", "Content-Type": "image/png" },
          pngBytes(),
        ),
      ).toBe(403);
      expect(
        (
          await fetch(runtime.origin + "/mcp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{not-valid-json",
          })
        ).status,
      ).toBe(401);
      expect(
        (
          await fetch(runtime.origin + "/mcp", {
            method: "POST",
            headers: {
              Authorization: "Bearer mcp-secret",
              Origin: "https://evil.example",
              "Content-Type": "application/json",
            },
            body: "{not-valid-json",
          })
        ).status,
      ).toBe(403);
    } finally {
      await runtime.close();
    }
  });

  test("removes partial files and invalidates failed capabilities", async () => {
    const store = await createStore();
    const capability = await store.createCapability({
      owner: "owner-1",
      filename: "reference.png",
      contentType: "image/png",
      size: pngBytes().length + 4,
    });
    const runtime = await listen(store);
    try {
      const path = new URL(capability.uploadUrl).pathname;
      expect(
        await rawPut(
          runtime.origin + path,
          { "Content-Type": "image/png" },
          pngBytes(),
        ),
      ).toBe(400);
      const rootEntries = await readdir(roots[0]);
      const instances = await readdir(join(roots[0], rootEntries[0]));
      const instanceEntries = await readdir(
        join(roots[0], rootEntries[0], instances[0]),
      );
      expect(instanceEntries).toEqual([]);
      expect(
        (
          await fetch(runtime.origin + path, {
            method: "PUT",
            headers: { "Content-Type": "image/png" },
            body: uploadBody(),
          })
        ).status,
      ).toBe(404);
    } finally {
      await runtime.close();
    }
  });
});

describe("temporary upload quotas and expiry", () => {
  test("enforces owner quota and expires pending capabilities", async () => {
    let now = 1_000;
    const store = await createStore({
      now: () => now,
      maxOwnerFiles: 1,
      uploadTtlMs: 100,
    });
    await store.createCapability({
      owner: "owner-1",
      filename: "one.png",
      contentType: "image/png",
      size: pngBytes().length,
    });
    await expect(
      store.createCapability({
        owner: "owner-1",
        filename: "two.png",
        contentType: "image/png",
        size: pngBytes().length,
      }),
    ).rejects.toThrow(/owner quota/);
    now += 101;
    await store.cleanup();
    await expect(
      store.createCapability({
        owner: "owner-1",
        filename: "two.png",
        contentType: "image/png",
        size: pngBytes().length,
      }),
    ).resolves.toBeDefined();
  });

  test("does not leak secrets in capability tool output", async () => {
    const store = await createStore();
    const result = await getUploadUrlTool.run(
      {
        app_grant: "g".repeat(43),
        filename: "reference.png",
        content_type: "image/png",
        size: pngBytes().length,
      },
      toolContext(store),
    );
    expect(result.content[0].text).not.toContain("mcp-secret");
    expect(result.content[0].text).not.toContain("KIE_AI_API_KEY");
    expect(result.content[0].text).not.toContain("/upload/");
    expect(result.content[0].text).not.toContain("/media/");
    expect(result._meta?.upload).toMatchObject({
      upload_url: expect.stringContaining("/upload/"),
    });
  });

  test("expires provider download capabilities and bounds replay", async () => {
    let now = 1_000;
    const store = await createStore({
      now: () => now,
      downloadTtlMs: 100,
      maxDownloadRequests: 2,
    });
    const capability = await store.createCapability({
      owner: "owner-1",
      filename: "reference.png",
      contentType: "image/png",
      size: pngBytes().length,
    });
    const runtime = await listen(store);
    try {
      const uploadPath = new URL(capability.uploadUrl).pathname;
      expect(
        (
          await fetch(runtime.origin + uploadPath, {
            method: "PUT",
            headers: { "Content-Type": "image/png" },
            body: uploadBody(),
          })
        ).status,
      ).toBe(201);
      const provider = await store.createProviderDownload({
        mediaId: capability.mediaId,
        owner: "owner-1",
      });
      const path = new URL(provider.url).pathname;
      expect((await fetch(runtime.origin + path)).status).toBe(200);
      expect((await fetch(runtime.origin + path)).status).toBe(200);
      expect((await fetch(runtime.origin + path)).status).toBe(404);

      const second = await store.createProviderDownload({
        mediaId: capability.mediaId,
        owner: "owner-1",
      });
      now += 101;
      expect(
        (await fetch(runtime.origin + new URL(second.url).pathname)).status,
      ).toBe(404);
    } finally {
      await runtime.close();
    }
  });

  test("allows only one concurrent upload and rejects encoded traversal", async () => {
    const store = await createStore();
    const capability = await store.createCapability({
      owner: "owner-1",
      filename: "reference.png",
      contentType: "image/png",
      size: pngBytes().length,
    });
    const runtime = await listen(store);
    try {
      const path = runtime.origin + new URL(capability.uploadUrl).pathname;
      const statuses = await Promise.all([
        rawPut(path, { "Content-Type": "image/png" }, pngBytes()),
        rawPut(path, { "Content-Type": "image/png" }, pngBytes()),
      ]);
      expect(statuses.sort()).toEqual([201, 404]);
      for (const attack of [
        "/media/..%2Fsecret",
        "/media/%2e%2e",
        "/media/%2500",
        "/media/%5csecret",
      ]) {
        expect((await fetch(runtime.origin + attack)).status).toBe(404);
      }
    } finally {
      await runtime.close();
    }
  });

  test("aborts stalled uploads and releases their quota", async () => {
    const store = await createStore({
      maxOwnerFiles: 1,
      uploadIdleTimeoutMs: 1_000,
      uploadMaxDurationMs: 20,
    });
    const capability = await store.createCapability({
      owner: "owner-1",
      filename: "reference.png",
      contentType: "image/png",
      size: pngBytes().length,
    });
    const runtime = await listen(store);
    try {
      await stalledPut(
        runtime.origin + new URL(capability.uploadUrl).pathname,
        pngBytes(),
      );
      await new Promise((resolve) => setTimeout(resolve, 20));
      await expect(
        store.createCapability({
          owner: "owner-1",
          filename: "retry.png",
          contentType: "image/png",
          size: pngBytes().length,
        }),
      ).resolves.toBeDefined();
    } finally {
      await runtime.close();
    }
  });

  test("removes stale crash directories on startup", async () => {
    const root = await mkdtemp(join(tmpdir(), "kie-upload-crash-test-"));
    roots.push(root);
    const stale = join(root, "kie-mcp-uploads", "instance-stale");
    await mkdir(stale, { recursive: true });
    await writeFile(join(stale, "orphan.media"), pngBytes());
    await utimes(stale, new Date(0), new Date(0));
    const store = new TemporaryUploadStore({
      publicBaseUrl: "http://127.0.0.1",
      storageRoot: root,
      downloadTtlMs: 100,
      now: () => 10_000,
    });
    stores.push(store);
    expect(await readdir(join(root, "kie-mcp-uploads"))).not.toContain(
      "instance-stale",
    );
    const laterStale = join(
      root,
      "kie-mcp-uploads",
      "instance-later-stale",
    );
    await mkdir(laterStale, { recursive: true });
    await writeFile(join(laterStale, "orphan.media"), pngBytes());
    await utimes(laterStale, new Date(0), new Date(0));
    await store.cleanup();
    expect(await readdir(join(root, "kie-mcp-uploads"))).not.toContain(
      "instance-later-stale",
    );
  });
});

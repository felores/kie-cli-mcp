import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ToolContext } from "@felores/kie-ai-core";
import { afterEach, describe, expect, test } from "@jest/globals";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport, Server } from "@modelcontextprotocol/server";
import { createHttpApp } from "../http-transport.js";
import { KieAiMcpServer } from "../index.js";
import { TemporaryUploadStore } from "../upload-storage.js";

// Phase 1 state ownership: every Server instance derives its approval owner
// and widget grant space from the caller principal, so a fresh instance can
// resolve state created by an earlier instance of the same principal. These
// tests prove that across real InMemory MCP sessions and the real upload store.

const directories: string[] = [];
const stores: TemporaryUploadStore[] = [];

afterEach(async () => {
  await Promise.all(stores.splice(0).map((store) => store.close()));
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function pngBytes(): Uint8Array {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
}

async function connectPair(
  server: Server,
  clients: Client[],
  servers: Server[],
): Promise<Client> {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client(
    { name: "state-ownership-test", version: "1.0.0" },
    { capabilities: {} },
  );
  clients.push(client);
  servers.push(server);
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return client;
}

function grantResult(result: unknown): {
  _meta?: { upload?: { app_grant?: string } };
} {
  return result as { _meta?: { upload?: { app_grant?: string } } };
}

async function listenWith(store: TemporaryUploadStore): Promise<{
  origin: string;
  close: () => Promise<void>;
}> {
  const app = createHttpApp({
    createServer: () =>
      new Server(
        { name: "upload-routes", version: "test" },
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
  const address = server.address() as { port: number };
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

describe("principal state ownership across server instances", () => {
  test("widget grants minted on one instance validate on another of the same principal", async () => {
    const directory = mkdtempSync(join(tmpdir(), "kie-state-owner-grants-"));
    directories.push(directory);
    const previousKey = process.env.KIE_AI_API_KEY;
    const previousDb = process.env.KIE_AI_DB_PATH;
    process.env.KIE_AI_API_KEY = "test-key-no-network";
    process.env.KIE_AI_DB_PATH = join(directory, "tasks.db");

    const app = new KieAiMcpServer();
    const privateApp = app as unknown as {
      toolContext: Omit<ToolContext, "approvalContext">;
      db: { close(): Promise<void> };
    };
    privateApp.toolContext = {
      ...privateApp.toolContext,
      createUploadCapability: async () => ({
        uploadUrl: "https://uploads.example/upload/token",
        mediaId: "02a9f79d-cbca-44f8-a93e-10fbe6e76848",
        uploadExpiresAt: "2026-08-22T23:00:00.000Z",
      }),
    };
    const clients: Client[] = [];
    const servers: Server[] = [];
    try {
      const alphaA = await connectPair(
        app.createServer("alpha"),
        clients,
        servers,
      );
      const alphaB = await connectPair(
        app.createServer("alpha"),
        clients,
        servers,
      );
      const beta = await connectPair(
        app.createServer("beta"),
        clients,
        servers,
      );

      const grant = grantResult(
        await alphaA.callTool({ name: "upload_widget", arguments: {} }),
      )._meta?.upload?.app_grant;
      expect(grant).toEqual(expect.any(String));

      const minted = (await alphaB.callTool({
        name: "get_upload_url",
        arguments: {
          app_grant: grant,
          filename: "reference.png",
          content_type: "image/png",
          size: pngBytes().length,
        },
      })) as { content: Array<{ type: "text"; text: string }> };
      expect(JSON.parse(minted.content[0].text)).toMatchObject({
        success: true,
      });

      const denied = (await beta.callTool({
        name: "get_upload_url",
        arguments: {
          app_grant: grant,
          filename: "reference.png",
          content_type: "image/png",
          size: pngBytes().length,
        },
      })) as { content: Array<{ type: "text"; text: string }> };
      expect(denied.content[0].text).toContain(
        "Invalid or expired widget grant.",
      );
    } finally {
      for (const client of clients) await client.close();
      for (const server of servers) await server.close();
      await (app as unknown as { db: { close(): Promise<void> } }).db.close();
      if (previousKey === undefined) delete process.env.KIE_AI_API_KEY;
      else process.env.KIE_AI_API_KEY = previousKey;
      if (previousDb === undefined) delete process.env.KIE_AI_DB_PATH;
      else process.env.KIE_AI_DB_PATH = previousDb;
    }
  });

  test("uploads staged by one instance finalize on another of the same principal, and never on a different one", async () => {
    const directory = mkdtempSync(join(tmpdir(), "kie-state-owner-uploads-"));
    directories.push(directory);
    const previousKey = process.env.KIE_AI_API_KEY;
    const previousDb = process.env.KIE_AI_DB_PATH;
    process.env.KIE_AI_API_KEY = "test-key-no-network";
    process.env.KIE_AI_DB_PATH = join(directory, "tasks.db");

    const store = new TemporaryUploadStore({
      publicBaseUrl: "http://127.0.0.1",
      storageRoot: directory,
    });
    stores.push(store);

    const app = new KieAiMcpServer();
    const privateApp = app as unknown as {
      toolContext: Omit<ToolContext, "approvalContext">;
      db: { close(): Promise<void> };
    };
    privateApp.toolContext = {
      ...privateApp.toolContext,
      createUploadCapability: (request) => store.createCapability(request),
      finalizeUpload: async (request) => {
        const staged = await store.createProviderDownload({
          mediaId: request.mediaId,
          owner: request.owner,
        });
        return {
          downloadUrl: staged.url,
          filename: staged.filename,
          contentType: staged.contentType,
          size: staged.size,
        };
      },
      getUploadPublicOrigin: () => store.publicOrigin,
    };

    const runtime = await listenWith(store);
    const clients: Client[] = [];
    const servers: Server[] = [];
    try {
      const alphaStager = await connectPair(
        app.createServer("alpha"),
        clients,
        servers,
      );
      const alphaFinalizer = await connectPair(
        app.createServer("alpha"),
        clients,
        servers,
      );
      const beta = await connectPair(
        app.createServer("beta"),
        clients,
        servers,
      );

      const grant = grantResult(
        await alphaStager.callTool({ name: "upload_widget", arguments: {} }),
      )._meta?.upload?.app_grant;
      const minted = (await alphaStager.callTool({
        name: "get_upload_url",
        arguments: {
          app_grant: grant,
          filename: "reference.png",
          content_type: "image/png",
          size: pngBytes().length,
        },
      })) as {
        content: Array<{ type: "text"; text: string }>;
        _meta?: { upload?: { upload_url?: string } };
      };
      const uploadPath = new URL(minted._meta?.upload?.upload_url ?? "")
        .pathname;
      expect(uploadPath).toContain("/upload/");

      const put = await fetch(runtime.origin + uploadPath, {
        method: "PUT",
        headers: {
          Origin: "https://sandbox.example",
          "Content-Type": "image/png",
          "Content-Length": String(pngBytes().length),
        },
        body: Buffer.from(pngBytes()),
      });
      expect(put.status).toBe(201);
      const staged = (await put.json()) as { media_id: string };

      const finalizerGrant = grantResult(
        await alphaFinalizer.callTool({
          name: "upload_widget",
          arguments: {},
        }),
      )._meta?.upload?.app_grant;
      const finalized = (await alphaFinalizer.callTool({
        name: "finalize_upload",
        arguments: {
          app_grant: finalizerGrant,
          media_id: staged.media_id,
        },
      })) as { content: Array<{ type: "text"; text: string }> };
      expect(JSON.parse(finalized.content[0].text)).toMatchObject({
        success: true,
      });

      const betaGrant = grantResult(
        await beta.callTool({ name: "upload_widget", arguments: {} }),
      )._meta?.upload?.app_grant;
      const denied = (await beta.callTool({
        name: "finalize_upload",
        arguments: {
          app_grant: betaGrant,
          media_id: staged.media_id,
        },
      })) as { content: Array<{ type: "text"; text: string }> };
      expect(denied.content[0].text).toContain("Media not found or not ready");
    } finally {
      for (const client of clients) await client.close();
      for (const server of servers) await server.close();
      await privateApp.db.close();
      await runtime.close();
      if (previousKey === undefined) delete process.env.KIE_AI_API_KEY;
      else process.env.KIE_AI_API_KEY = previousKey;
      if (previousDb === undefined) delete process.env.KIE_AI_DB_PATH;
      else process.env.KIE_AI_DB_PATH = previousDb;
    }
  });
});

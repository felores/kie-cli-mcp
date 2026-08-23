import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "@jest/globals";
import { Client } from "@modelcontextprotocol/client";
import { DiscoverResultSchema } from "@modelcontextprotocol/core";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import {
  APPS_EXTENSION_NAME,
  buildDiscoverPayload,
  toolOutputSchema,
} from "../discovery.js";
import { KieAiMcpServer } from "../index.js";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

async function connectedClient(directGeneration: boolean): Promise<{
  app: KieAiMcpServer;
  client: Client;
  server: import("@modelcontextprotocol/server").Server;
  close: () => Promise<void>;
}> {
  const directory = mkdtempSync(join(tmpdir(), "kie-disc-"));
  directories.push(directory);
  const previousKey = process.env.KIE_AI_API_KEY;
  const previousDb = process.env.KIE_AI_DB_PATH;
  const previousDirect = process.env.KIE_AI_ALLOW_DIRECT_GENERATION;
  process.env.KIE_AI_API_KEY = "test-key-no-network";
  process.env.KIE_AI_DB_PATH = join(directory, "tasks.db");
  if (directGeneration) process.env.KIE_AI_ALLOW_DIRECT_GENERATION = "true";
  else delete process.env.KIE_AI_ALLOW_DIRECT_GENERATION;

  const app = new KieAiMcpServer();
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client(
    { name: "discovery-test", version: "1.0.0" },
    { capabilities: {} },
  );
  const server = app.createServer();
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return {
    app,
    client,
    server,
    close: async () => {
      await client.close();
      await server.close();
      await (app as unknown as { db: { close(): Promise<void> } }).db.close();
      if (previousKey === undefined) delete process.env.KIE_AI_API_KEY;
      else process.env.KIE_AI_API_KEY = previousKey;
      if (previousDb === undefined) delete process.env.KIE_AI_DB_PATH;
      else process.env.KIE_AI_DB_PATH = previousDb;
      if (previousDirect === undefined)
        delete process.env.KIE_AI_ALLOW_DIRECT_GENERATION;
      else process.env.KIE_AI_ALLOW_DIRECT_GENERATION = previousDirect;
    },
  };
}

describe("MCP server discovery and output schemas", () => {
  test("exposes outputSchema for prepare and upload tools by default", async () => {
    const runtime = await connectedClient(false);
    try {
      const tools = (await runtime.client.listTools()).tools;
      const byName = new Map(tools.map((tool) => [tool.name, tool]));

      const prepare = byName.get("prepare_media_generation");
      expect(prepare?.outputSchema).toMatchObject({
        type: "object",
        properties: { plan_id: { type: "string" } },
      });
      expect(prepare?.outputSchema).toMatchObject({
        required: expect.arrayContaining(["plan_id"]),
      });

      const upload = byName.get("get_upload_url");
      expect(upload?.outputSchema).toMatchObject({
        type: "object",
        properties: { media_id: { type: "string" } },
      });

      // Utility tools without guaranteed structured content stay schema-free.
      expect(byName.get("list_tasks")?.outputSchema).toBeUndefined();
    } finally {
      await runtime.close();
    }
  });

  test("attaches task outputSchema to generation tools when direct mode exposes them", async () => {
    const runtime = await connectedClient(true);
    try {
      const tools = (await runtime.client.listTools()).tools;
      const byName = new Map(tools.map((tool) => [tool.name, tool]));

      const generation = byName.get("nano_banana_image");
      expect(generation?.outputSchema).toMatchObject({
        type: "object",
        properties: { task_id: { type: "string" } },
      });
    } finally {
      await runtime.close();
    }
  });

  test("discovery payload is schema-valid and selector-consistent", () => {
    const payload = buildDiscoverPayload("instructions");
    // The published v2 SDK caps negotiation at the 2025-11-25 revision; the
    // 2026-era vocabulary is ready and activates when the SDK lifts the cap.
    expect(payload.supportedVersions).toContain("2025-11-25");
    expect(DiscoverResultSchema.safeParse(payload).success).toBe(true);
    expect(
      payload.capabilities?.extensions?.[APPS_EXTENSION_NAME],
    ).toMatchObject({ mimeTypes: ["text/html;profile=mcp-app"] });

    expect(
      toolOutputSchema({
        name: "prepare_media_generation",
        category: "utility",
      }),
    ).toBeDefined();
    expect(
      toolOutputSchema({ name: "get_upload_url", category: "utility" }),
    ).toBeDefined();
    expect(
      toolOutputSchema({ name: "nano_banana_image", category: "image" }),
    ).toBeDefined();
    expect(
      toolOutputSchema({ name: "veo3_generate_video", category: "video" }),
    ).toBeDefined();
    expect(
      toolOutputSchema({ name: "list_tasks", category: "utility" }),
    ).toBeUndefined();
    expect(
      toolOutputSchema({ name: "upload_widget", category: "utility" }),
    ).toBeUndefined();
  });
});

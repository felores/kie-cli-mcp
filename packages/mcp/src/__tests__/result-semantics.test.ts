import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "@jest/globals";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { KieAiMcpServer } from "../index.js";

// Result semantics phase: error envelopes carry isError plus structured
// content end to end, and task-bearing successes expose structuredContent.

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

async function connect(app: KieAiMcpServer): Promise<{
  client: Client;
  server: Server;
  close: () => Promise<void>;
}> {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client(
    { name: "result-semantics-test", version: "1.0.0" },
    { capabilities: {} },
  );
  const server = app.createServer();
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return {
    client,
    server,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

describe("MCP result semantics", () => {
  test("a failed tool call reaches the client as an error result with structured content", async () => {
    const directory = mkdtempSync(join(tmpdir(), "kie-results-error-"));
    directories.push(directory);
    const previousKey = process.env.KIE_AI_API_KEY;
    const previousDb = process.env.KIE_AI_DB_PATH;
    process.env.KIE_AI_API_KEY = "test-key-no-network";
    process.env.KIE_AI_DB_PATH = join(directory, "tasks.db");

    const app = new KieAiMcpServer();
    const runtime = await connect(app);
    try {
      // Invalid input: embedded mode with one to six items, empty is invalid.
      const result = (await runtime.client.callTool({
        name: "prepare_media_generation",
        arguments: { items: [] },
      })) as {
        isError?: boolean;
        structuredContent?: Record<string, unknown>;
        content: Array<{ type: string; text: string }>;
      };
      expect(result.isError).toBe(true);
      expect(result.structuredContent).toMatchObject({
        success: false,
        tool: "prepare_media_generation",
      });
      expect(JSON.parse(result.content[0].text)).toMatchObject({
        success: false,
      });
    } finally {
      await runtime.close();
      await (app as unknown as { db: { close(): Promise<void> } }).db.close();
      if (previousKey === undefined) delete process.env.KIE_AI_API_KEY;
      else process.env.KIE_AI_API_KEY = previousKey;
      if (previousDb === undefined) delete process.env.KIE_AI_DB_PATH;
      else process.env.KIE_AI_DB_PATH = previousDb;
    }
  });

  test("a prepared plan exposes structuredContent end to end", async () => {
    const directory = mkdtempSync(join(tmpdir(), "kie-results-plan-"));
    directories.push(directory);
    const previousKey = process.env.KIE_AI_API_KEY;
    const previousDb = process.env.KIE_AI_DB_PATH;
    const previousDirect = process.env.KIE_AI_ALLOW_DIRECT_GENERATION;
    process.env.KIE_AI_API_KEY = "test-key-no-network";
    process.env.KIE_AI_DB_PATH = join(directory, "tasks.db");
    delete process.env.KIE_AI_ALLOW_DIRECT_GENERATION;

    const app = new KieAiMcpServer();
    const runtime = await connect(app);
    try {
      const result = (await runtime.client.callTool({
        name: "prepare_media_generation",
        arguments: {
          items: [{ tool: "nano_banana_image", args: { prompt: "a cat" } }],
        },
      })) as {
        structuredContent?: Record<string, unknown>;
        content: Array<{ type: string; text: string }>;
      };
      expect(result.structuredContent).toMatchObject({
        plan_id: expect.any(String),
        status: "prepared",
        approved: false,
      });
      expect(JSON.parse(result.content[0].text)).toMatchObject({
        success: true,
      });
    } finally {
      await runtime.close();
      await (app as unknown as { db: { close(): Promise<void> } }).db.close();
      if (previousKey === undefined) delete process.env.KIE_AI_API_KEY;
      else process.env.KIE_AI_API_KEY = previousKey;
      if (previousDb === undefined) delete process.env.KIE_AI_DB_PATH;
      else process.env.KIE_AI_DB_PATH = previousDb;
      if (previousDirect === undefined)
        delete process.env.KIE_AI_ALLOW_DIRECT_GENERATION;
      else process.env.KIE_AI_ALLOW_DIRECT_GENERATION = previousDirect;
    }
  });
});

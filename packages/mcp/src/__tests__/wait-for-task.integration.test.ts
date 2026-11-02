import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { KieAiMcpServer } from "../index.js";

const IMAGE_URL = "https://example.com/result-1.png";

describe("MCP wait_for_task structured content", () => {
  test("a completed task exposes result_urls to clients that read structuredContent", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kie-mcp-wait-task-"));
    const prevKey = process.env.KIE_AI_API_KEY;
    const prevDb = process.env.KIE_AI_DB_PATH;
    process.env.KIE_AI_API_KEY = "test-key-no-network";
    process.env.KIE_AI_DB_PATH = join(dir, "tasks.db");
    const app = new KieAiMcpServer();
    const internals = app as unknown as {
      client: { getTaskStatus: () => Promise<unknown> };
      db: {
        createTask(task: Record<string, unknown>): Promise<void>;
        close(): Promise<void>;
      };
    };
    internals.client.getTaskStatus = async () => ({
      code: 200,
      msg: "success",
      data: {
        state: "success",
        resultJson: JSON.stringify({ resultUrls: [IMAGE_URL] }),
      },
    });
    await internals.db.createTask({
      task_id: "task-done-1",
      api_type: "gpt-image",
      status: "pending",
    });

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const client = new Client(
      { name: "wait-for-task-test", version: "1.0.0" },
      { capabilities: {} },
    );
    const server = app.createServer();
    try {
      await Promise.all([
        server.connect(serverTransport),
        client.connect(clientTransport),
      ]);
      // Listing first makes the client validate any declared outputSchema.
      await client.listTools();
      const result = (await client.callTool({
        name: "wait_for_task",
        arguments: { task_id: "task-done-1", timeout_seconds: 5 },
      })) as {
        isError?: boolean;
        content: Array<{ type: string; text: string }>;
        structuredContent?: Record<string, unknown>;
      };
      expect(result.isError).toBeFalsy();
      expect(JSON.parse(result.content[0].text)).toMatchObject({
        status: "completed",
        result_urls: [IMAGE_URL],
      });
      expect(result.structuredContent).toMatchObject({
        task_id: "task-done-1",
        status: "completed",
        result_urls: [IMAGE_URL],
      });
    } finally {
      await client.close();
      await server.close();
      await internals.db.close();
      if (prevKey === undefined) delete process.env.KIE_AI_API_KEY;
      else process.env.KIE_AI_API_KEY = prevKey;
      if (prevDb === undefined) delete process.env.KIE_AI_DB_PATH;
      else process.env.KIE_AI_DB_PATH = prevDb;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TaskDatabase } from "@felores/kie-ai-core/database";
import { afterEach, describe, expect, test } from "@jest/globals";
import { CancelTaskResultSchema } from "@modelcontextprotocol/core";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { KieAiMcpServer } from "../index.js";
import { TaskEngine } from "../tasks.js";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

interface RawPeer {
  rpc: (method: string, params: unknown) => Promise<Record<string, unknown>>;
  notify: (method: string, params: unknown) => Promise<void>;
  close: () => Promise<void>;
}

async function connectRaw(app: KieAiMcpServer): Promise<RawPeer> {
  const [clientHalf, serverHalf] = InMemoryTransport.createLinkedPair();
  const server = app.createServer();
  await server.connect(serverHalf);
  const pending = new Map<number, (msg: Record<string, unknown>) => void>();
  clientHalf.onmessage = (msg) => {
    const record = msg as unknown as Record<string, unknown>;
    if (
      typeof record.id === "number" &&
      (record.result !== undefined || record.error !== undefined)
    ) {
      pending.get(record.id)?.(record);
      pending.delete(record.id);
    }
  };
  await clientHalf.start();
  let counter = 0;
  const nextId = () => ++counter;
  return {
    rpc: (method, params) => {
      const id = nextId();
      const promise = new Promise<Record<string, unknown>>((resolve) => {
        pending.set(id, resolve);
      });
      void clientHalf.send({
        jsonrpc: "2.0",
        id,
        method,
        params,
      } as never);
      return promise;
    },
    notify: async (method, params) => {
      await clientHalf.send({
        jsonrpc: "2.0",
        method,
        params,
      } as never);
    },
    close: async () => {
      await clientHalf.close();
      await server.close();
    },
  };
}

async function setupRawApp(): Promise<{
  app: KieAiMcpServer;
  peer: RawPeer;
  teardown: () => Promise<void>;
}> {
  const directory = mkdtempSync(join(tmpdir(), "kie-tasks-"));
  directories.push(directory);
  const previousKey = process.env.KIE_AI_API_KEY;
  const previousDb = process.env.KIE_AI_DB_PATH;
  const previousTasks = process.env.KIE_AI_MCP_TASKS;
  process.env.KIE_AI_API_KEY = "test-key-no-network";
  process.env.KIE_AI_DB_PATH = join(directory, "tasks.db");
  process.env.KIE_AI_MCP_TASKS = "true";
  const app = new KieAiMcpServer();
  const peer = await connectRaw(app);
  return {
    app,
    peer,
    teardown: async () => {
      await peer.close();
      await (app as unknown as { db: { close(): Promise<void> } }).db.close();
      if (previousKey === undefined) delete process.env.KIE_AI_API_KEY;
      else process.env.KIE_AI_API_KEY = previousKey;
      if (previousDb === undefined) delete process.env.KIE_AI_DB_PATH;
      else process.env.KIE_AI_DB_PATH = previousDb;
      if (previousTasks === undefined) delete process.env.KIE_AI_MCP_TASKS;
      else process.env.KIE_AI_MCP_TASKS = previousTasks;
    },
  };
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

describe("MCP official Tasks (server surface)", () => {
  test("negotiates tasks capability and marks every tool execution.taskSupport", async () => {
    const { app, peer, teardown } = await setupRawApp();
    try {
      const init = await peer.rpc("initialize", {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "raw-peer", version: "1" },
      });
      expect(
        (init.result as { capabilities: { tasks?: unknown } }).capabilities
          .tasks,
      ).toEqual({});
      await peer.notify("notifications/initialized", {});

      const listed = await peer.rpc("tools/list", {});
      const tools = (
        listed.result as {
          tools: Array<{ name?: string; execution?: { taskSupport?: string } }>;
        }
      ).tools;
      expect(tools.length).toBeGreaterThan(0);
      for (const tool of tools) {
        expect(tool.execution?.taskSupport).toBe("optional");
      }
    } finally {
      await teardown();
      void app;
    }
  });

  test("deferred: tools/call task mode is rejected by the 2025-era SDK validation", async () => {
    // The published v2 SDK validates tools/call results against the 2025-era
    // CallToolResult schema even when a `task` parameter is present, so a
    // server task result is rejected with -32602 ("content is required when
    // the body carries 'task'"). The server side is spec-correct and this
    // test flips to the full assertion once the SDK lifts negotiation.
    const { app, peer, teardown } = await setupRawApp();
    try {
      await peer.rpc("initialize", {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "raw-peer", version: "1" },
      });
      await peer.notify("notifications/initialized", {});

      const created = await peer.rpc("tools/call", {
        name: "list_tasks",
        arguments: { limit: 5 },
        task: { ttl: 30000, pollInterval: 100 },
      });
      // Gated before any engine start: no orphaned task, a clear refusal.
      expect((created.error as { code?: number })?.code).toBe(-32600);
      expect((created.error as { message?: string })?.message).toMatch(
        /2026-07-28/,
      );
    } finally {
      await teardown();
      void app;
    }
  });
});

describe("TaskEngine", () => {
  test("starts working, completes with the result, and expires", async () => {
    const directory = mkdtempSync(join(tmpdir(), "kie-engine-1-"));
    directories.push(directory);
    const db = new TaskDatabase(join(directory, "engine.db"));
    let now = 1_000_000;
    const engine = new TaskEngine(db, () => now);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = engine.start(
      "list_tasks",
      async () => {
        await gate;
        return { content: [{ type: "text", text: '{"success":true}' }] };
      },
      { ttl: 1000, pollInterval: 100 },
    );
    expect(started.status).toBe("working");
    expect(engine.get(started.taskId)?.status).toBe("working");

    release();
    await sleep(10);
    const done = engine.get(started.taskId);
    expect(done?.status).toBe("completed");
    expect(done?.result?.content[0].text).toBe('{"success":true}');

    now += 2000;
    expect(engine.get(started.taskId)).toBeUndefined();
    await db.close();
  });

  test("cancel flips a working task to cancelled", async () => {
    const directory = mkdtempSync(join(tmpdir(), "kie-engine-2-"));
    directories.push(directory);
    const db = new TaskDatabase(join(directory, "engine.db"));
    const engine = new TaskEngine(db);
    const started = engine.start("list_tasks", async () => {
      await new Promise(() => undefined);
      return { content: [{ type: "text", text: "" }] };
    });
    engine.cancel(started.taskId);
    expect(engine.get(started.taskId)?.status).toBe("cancelled");
    await db.close();
  });

  test("failure records the error and flips status", async () => {
    const directory = mkdtempSync(join(tmpdir(), "kie-engine-3-"));
    directories.push(directory);
    const db = new TaskDatabase(join(directory, "engine.db"));
    const engine = new TaskEngine(db);
    const started = engine.start("nano_banana_image", async () => {
      throw new Error("provider said no");
    });
    await sleep(10);
    const done = engine.get(started.taskId);
    expect(done?.status).toBe("failed");
    expect(done?.error).toBe("provider said no");
    await db.close();
  });
});

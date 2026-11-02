import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, jest, test } from "@jest/globals";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { KieAiMcpServer } from "../index.js";

type Structured = Record<string, unknown> & { plan_id: string };

// The client validates `structuredContent` against the tool's declared
// `outputSchema` only after it has listed the tools, so every case lists first.
// A result that drifts from its schema makes `callTool` throw.
async function withClient(
  capabilities: Record<string, unknown>,
  confirm: boolean,
  run: (ctx: {
    call: (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ structuredContent?: Structured; isError?: boolean }>;
    schemas: Map<string, unknown>;
  }) => Promise<void>,
) {
  const dir = mkdtempSync(join(tmpdir(), "kie-mcp-output-schema-"));
  const prevKey = process.env.KIE_AI_API_KEY;
  const prevDb = process.env.KIE_AI_DB_PATH;
  process.env.KIE_AI_API_KEY = "test-key-no-network";
  process.env.KIE_AI_DB_PATH = join(dir, "tasks.db");
  const app = new KieAiMcpServer();
  const providerCall = jest.fn(async () => ({
    code: 200,
    msg: "ok",
    data: { taskId: "local-provider-task" },
  }));
  (
    app as unknown as {
      client: { generateNanoBananaImage: typeof providerCall };
    }
  ).client.generateNanoBananaImage = providerCall;
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client(
    { name: "output-schema-test", version: "1.0.0" },
    { capabilities },
  );
  if (capabilities.elicitation)
    client.setRequestHandler("elicitation/create", async () => ({
      action: "accept",
      content: { confirm },
    }));
  const server = app.createServer();
  try {
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
    const listed = await client.listTools();
    const schemas = new Map(
      listed.tools.map((tool) => [tool.name, tool.outputSchema]),
    );
    await run({
      schemas,
      call: async (name, args) =>
        (await client.callTool({ name, arguments: args })) as {
          structuredContent?: Structured;
          isError?: boolean;
        },
    });
  } finally {
    await client.close();
    await server.close();
    await (app as unknown as { db: { close(): Promise<void> } }).db.close();
    if (prevKey === undefined) delete process.env.KIE_AI_API_KEY;
    else process.env.KIE_AI_API_KEY = prevKey;
    if (prevDb === undefined) delete process.env.KIE_AI_DB_PATH;
    else process.env.KIE_AI_DB_PATH = prevDb;
    rmSync(dir, { recursive: true, force: true });
  }
}

const prepareArgs = {
  items: [{ tool: "nano_banana_image", args: { prompt: "A red panda" } }],
};

describe("MCP structured content matches the declared outputSchema", () => {
  test("prepare without elicitation, then submit with approve", async () => {
    await withClient({}, false, async ({ call, schemas }) => {
      expect(schemas.get("prepare_media_generation")).toBeDefined();
      expect(schemas.get("submit_media_generation")).toBeDefined();
      const prepared = await call("prepare_media_generation", prepareArgs);
      expect(prepared.structuredContent).toMatchObject({
        approved: false,
        status: "prepared",
        plan: { items: [{ price: { credits: 4, usd: { amount: 0.02 } } }] },
      });
      const planId = prepared.structuredContent?.plan_id as string;
      const submitted = await call("submit_media_generation", {
        planId,
        approve: planId,
      });
      expect(submitted.isError).toBeFalsy();
      expect(submitted.structuredContent?.plan_id).toBe(planId);
    });
  });

  test("prepare approved through the elicitation form, then submit", async () => {
    await withClient({ elicitation: { form: {} } }, true, async ({ call }) => {
      const prepared = await call("prepare_media_generation", prepareArgs);
      expect(prepared.structuredContent).toMatchObject({
        approved: true,
        status: "approved",
      });
      const planId = prepared.structuredContent?.plan_id as string;
      const submitted = await call("submit_media_generation", { planId });
      expect(submitted.structuredContent?.plan_id).toBe(planId);
    });
  });

  test("prepare declined through the elicitation form", async () => {
    await withClient({ elicitation: { form: {} } }, false, async ({ call }) => {
      const prepared = await call("prepare_media_generation", prepareArgs);
      expect(prepared.structuredContent).toMatchObject({
        approved: false,
        status: "prepared",
      });
    });
  });

  test("an unknown price carries no USD and still matches the schema", async () => {
    await withClient({}, false, async ({ call }) => {
      const prepared = await call("prepare_media_generation", {
        items: [
          {
            tool: "nano_banana_image",
            args: { prompt: "A bear", model: "nano-banana-2" },
          },
        ],
      });
      expect(prepared.structuredContent).toMatchObject({
        plan: { total: { status: "unknown" } },
      });
    });
  });
});

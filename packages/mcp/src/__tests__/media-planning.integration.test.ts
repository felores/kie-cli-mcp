import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, jest, test } from "@jest/globals";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { KieAiMcpServer } from "../index.js";

function resultPayload(result: {
  content: Array<{ type: string; text: string }>;
}): Record<string, unknown> {
  const first = result.content[0];
  if (!first || first.type !== "text")
    throw new Error("Expected a text tool result.");
  return JSON.parse(first.text) as Record<string, unknown>;
}

describe("MCP media planning integration", () => {
  test("exposes documentation only for callable tools by default", async () => {
    const databaseDirectory = mkdtempSync(join(tmpdir(), "kie-mcp-resources-"));
    const previousApiKey = process.env.KIE_AI_API_KEY;
    const previousDatabasePath = process.env.KIE_AI_DB_PATH;
    const previousDirectGeneration = process.env.KIE_AI_ALLOW_DIRECT_GENERATION;
    process.env.KIE_AI_API_KEY = "test-key-no-network";
    process.env.KIE_AI_DB_PATH = join(databaseDirectory, "tasks.db");
    delete process.env.KIE_AI_ALLOW_DIRECT_GENERATION;

    const app = new KieAiMcpServer();
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const client = new Client(
      { name: "resource-access-integration-test", version: "1.0.0" },
      { capabilities: {} },
    );
    const server = app.createServer();
    try {
      await Promise.all([
        server.connect(serverTransport),
        client.connect(clientTransport),
      ]);

      const resources = await client.listResources();
      const resourceUris = resources.resources.map((resource) => resource.uri);
      expect(resourceUris).toContain("kie://tools/get_task_status");
      expect(resourceUris).not.toContain("kie://tools/nano_banana_image");

      await expect(
        client.readResource({ uri: "kie://tools/nano_banana_image" }),
      ).rejects.toThrow("Resource not found");
      await expect(
        client.readResource({ uri: "kie://tools/get_task_status" }),
      ).resolves.toMatchObject({
        contents: [
          expect.objectContaining({ uri: "kie://tools/get_task_status" }),
        ],
      });
    } finally {
      await client.close();
      await server.close();
      await (app as unknown as { db: { close(): Promise<void> } }).db.close();
      if (previousApiKey === undefined) delete process.env.KIE_AI_API_KEY;
      else process.env.KIE_AI_API_KEY = previousApiKey;
      if (previousDatabasePath === undefined) delete process.env.KIE_AI_DB_PATH;
      else process.env.KIE_AI_DB_PATH = previousDatabasePath;
      if (previousDirectGeneration === undefined)
        delete process.env.KIE_AI_ALLOW_DIRECT_GENERATION;
      else
        process.env.KIE_AI_ALLOW_DIRECT_GENERATION = previousDirectGeneration;
      rmSync(databaseDirectory, { recursive: true, force: true });
    }
  });

  test("elicits approval through the transport and submits only the confirmed plan", async () => {
    const databaseDirectory = mkdtempSync(
      join(tmpdir(), "kie-mcp-media-plan-"),
    );
    const previousApiKey = process.env.KIE_AI_API_KEY;
    const previousDatabasePath = process.env.KIE_AI_DB_PATH;
    process.env.KIE_AI_API_KEY = "test-key-no-network";
    process.env.KIE_AI_DB_PATH = join(databaseDirectory, "tasks.db");

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
      { name: "media-planning-integration-test", version: "1.0.0" },
      { capabilities: { elicitation: { form: {} } } },
    );
    let confirmsPlan = false;
    const elicitationRequests: Array<{
      message: string;
      confirmRequired: boolean;
    }> = [];
    client.setRequestHandler("elicitation/create", async (request) => {
      if (request.params.mode !== "form")
        throw new Error("Expected form elicitation.");
      elicitationRequests.push({
        message: request.params.message,
        confirmRequired:
          request.params.requestedSchema.required?.includes("confirm") ?? false,
      });
      return { action: "accept", content: { confirm: confirmsPlan } };
    });

    const server = app.createServer();
    try {
      await Promise.all([
        server.connect(serverTransport),
        client.connect(clientTransport),
      ]);

      const unconfirmed = resultPayload(
        (await client.callTool({
          name: "prepare_media_generation",
          arguments: {
            items: [
              { tool: "nano_banana_image", args: { prompt: "A red panda" } },
            ],
          },
        })) as { content: Array<{ type: string; text: string }> },
      );
      expect(unconfirmed).toMatchObject({
        success: true,
        approved: false,
        status: "prepared",
      });
      expect(providerCall).not.toHaveBeenCalled();
      expect(elicitationRequests[0].message).toContain("$0.02 USD");
      expect(elicitationRequests[0].message).toContain(
        "https://kie.ai/pricing",
      );
      expect(
        (unconfirmed.plan as { items: Array<{ price: unknown }> }).items[0]
          .price,
      ).toMatchObject({
        status: "exact",
        credits: 4,
        usd: { amount: 0.02, currency: "USD" },
      });

      const blockedSubmission = resultPayload(
        (await client.callTool({
          name: "submit_media_generation",
          arguments: { planId: unconfirmed.planId },
        })) as { content: Array<{ type: string; text: string }> },
      );
      expect(blockedSubmission).toMatchObject({
        success: false,
        error: expect.stringContaining("not approved"),
      });
      expect(providerCall).not.toHaveBeenCalled();

      confirmsPlan = true;
      const approved = resultPayload(
        (await client.callTool({
          name: "prepare_media_generation",
          arguments: {
            items: [
              {
                tool: "nano_banana_image",
                args: { prompt: "A confirmed red panda" },
              },
            ],
          },
        })) as { content: Array<{ type: string; text: string }> },
      );
      expect(approved).toMatchObject({
        success: true,
        approved: true,
        status: "approved",
      });
      expect(providerCall).not.toHaveBeenCalled();
      expect(elicitationRequests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            confirmRequired: true,
            message: expect.stringContaining("Approve media generation plan"),
          }),
        ]),
      );

      const submitted = resultPayload(
        (await client.callTool({
          name: "submit_media_generation",
          arguments: { planId: approved.planId },
        })) as { content: Array<{ type: string; text: string }> },
      );
      expect(submitted).toMatchObject({
        success: true,
        planId: approved.planId,
      });
      expect(providerCall).toHaveBeenCalledTimes(1);
    } finally {
      await client.close();
      await server.close();
      await (app as unknown as { db: { close(): Promise<void> } }).db.close();
      if (previousApiKey === undefined) delete process.env.KIE_AI_API_KEY;
      else process.env.KIE_AI_API_KEY = previousApiKey;
      if (previousDatabasePath === undefined) delete process.env.KIE_AI_DB_PATH;
      else process.env.KIE_AI_DB_PATH = previousDatabasePath;
      rmSync(databaseDirectory, { recursive: true, force: true });
    }
  });

  async function withClient(
    capabilities: Record<string, unknown>,
    run: (ctx: {
      call: (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<Record<string, unknown>>;
      providerCall: jest.Mock;
    }) => Promise<void>,
  ) {
    const dir = mkdtempSync(join(tmpdir(), "kie-mcp-chat-approval-"));
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
      { name: "chat-approval-test", version: "1.0.0" },
      { capabilities },
    );
    if (capabilities.elicitation)
      client.setRequestHandler("elicitation/create", async () => ({
        action: "decline",
      }));
    const server = app.createServer();
    try {
      await Promise.all([
        server.connect(serverTransport),
        client.connect(clientTransport),
      ]);
      await run({
        providerCall,
        call: async (name, args) =>
          resultPayload(
            (await client.callTool({ name, arguments: args })) as {
              content: Array<{ type: string; text: string }>;
            },
          ),
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

  test("a client without elicitation approves in chat with approve equal to planId", async () => {
    await withClient({}, async ({ call, providerCall }) => {
      const prepared = await call("prepare_media_generation", prepareArgs);
      expect(prepared).toMatchObject({ approved: false, status: "prepared" });
      const planId = prepared.planId as string;

      const missing = await call("submit_media_generation", { planId });
      expect(missing).toMatchObject({ success: false });
      const mismatched = await call("submit_media_generation", {
        planId,
        approve: "00000000-0000-4000-8000-000000000000",
      });
      expect(mismatched).toMatchObject({
        success: false,
        error: expect.stringContaining("approve must equal planId"),
      });
      expect(providerCall).not.toHaveBeenCalled();

      const submitted = await call("submit_media_generation", {
        planId,
        approve: planId,
      });
      expect(submitted).toMatchObject({ success: true, planId });
      expect(providerCall).toHaveBeenCalledTimes(1);

      const again = await call("submit_media_generation", {
        planId,
        approve: planId,
      });
      expect(again).toMatchObject({ success: false });
      expect(providerCall).toHaveBeenCalledTimes(1);
    });
  });

  test("a form-capable client cannot skip its declined form with approve", async () => {
    await withClient(
      { elicitation: { form: {} } },
      async ({ call, providerCall }) => {
        const prepared = await call("prepare_media_generation", prepareArgs);
        const planId = prepared.planId as string;
        const result = await call("submit_media_generation", {
          planId,
          approve: planId,
        });
        expect(result).toMatchObject({
          success: false,
          error: expect.stringContaining("Chat approval is not available"),
        });
        expect(providerCall).not.toHaveBeenCalled();
      },
    );
  });
});

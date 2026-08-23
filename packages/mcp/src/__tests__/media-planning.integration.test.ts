import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, jest, test } from "@jest/globals";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ElicitRequestSchema } from "@modelcontextprotocol/sdk/types.js";
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
    client.setRequestHandler(ElicitRequestSchema, async (request) => {
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
});

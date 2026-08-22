import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, test } from "@jest/globals";
import type { ToolContext } from "@felores/kie-ai-core";
import { UPLOAD_WIDGET_URI } from "@felores/kie-ai-core";
import { KieAiMcpServer } from "../index.js";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("MCP Apps upload widget", () => {
  test("advertises stable metadata and serves a restrictive ui resource", async () => {
    const directory = mkdtempSync(join(tmpdir(), "kie-widget-test-"));
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
      finalizeUpload: async () => ({
        downloadUrl: "https://tempfile.redpandaai.co/final.png",
        filename: "reference.png",
        contentType: "image/png",
        size: 9,
      }),
      getUploadPublicOrigin: () => "https://uploads.example",
    };

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const client = new Client(
      { name: "widget-test", version: "1.0.0" },
      {
        capabilities: {
          extensions: {
            "io.modelcontextprotocol/ui": {
              mimeTypes: ["text/html;profile=mcp-app"],
            },
          },
        },
      },
    );
    const server = app.createServer();
    try {
      await Promise.all([
        server.connect(serverTransport),
        client.connect(clientTransport),
      ]);
      const tools = await client.listTools();
      const widget = tools.tools.find((tool) => tool.name === "upload_widget");
      const capability = tools.tools.find(
        (tool) => tool.name === "get_upload_url",
      );
      const finalize = tools.tools.find(
        (tool) => tool.name === "finalize_upload",
      );
      expect(widget?._meta).toMatchObject({
        ui: { resourceUri: UPLOAD_WIDGET_URI, visibility: ["model"] },
        "ui/resourceUri": UPLOAD_WIDGET_URI,
      });
      expect(capability?._meta).toMatchObject({
        ui: { visibility: ["app"] },
      });
      expect(finalize?._meta).toMatchObject({
        ui: { visibility: ["app"] },
      });

      const resources = await client.listResources();
      expect(resources.resources).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            uri: UPLOAD_WIDGET_URI,
            mimeType: "text/html;profile=mcp-app",
          }),
        ]),
      );
      expect(resources.resources).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ uri: "kie://tools/get_upload_url" }),
        ]),
      );
      const resource = await client.readResource({ uri: UPLOAD_WIDGET_URI });
      const content = resource.contents[0] as {
        text: string;
        mimeType: string;
        _meta?: {
          ui?: { csp?: { connectDomains?: string[] } };
        };
      };
      expect(content.mimeType).toBe("text/html;profile=mcp-app");
      expect(content._meta?.ui?.csp?.connectDomains).toEqual([
        "https://uploads.example",
      ]);
      expect(content.text).toContain('method: "ui/notifications/initialized"');
      expect(content.text).toContain('request("tools/call"');
      expect(content.text).not.toMatch(
        /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(/,
      );
      expect(content.text).not.toMatch(/KIE_AI_API_KEY|KIE_MCP_HTTP_TOKEN/);
      expect(content.text).not.toMatch(/<script\s+src=|<link\s+[^>]*href=/i);

      const toolResult = (await client.callTool({
        name: "upload_widget",
        arguments: {},
      })) as {
        content: Array<{ type: "text"; text: string }>;
        _meta?: { upload?: { app_grant?: string } };
      };
      const text = toolResult.content[0].text;
      expect(JSON.parse(text)).toMatchObject({
        success: true,
        widget: UPLOAD_WIDGET_URI,
      });
      const appGrant = toolResult._meta?.upload?.app_grant;
      expect(appGrant).toEqual(expect.any(String));

      let latestGrant = appGrant;
      for (let index = 0; index < 16; index += 1) {
        const next = (await client.callTool({
          name: "upload_widget",
          arguments: {},
        })) as { _meta?: { upload?: { app_grant?: string } } };
        latestGrant = next._meta?.upload?.app_grant;
      }
      expect(latestGrant).toEqual(expect.any(String));

      const denied = (await client.callTool({
        name: "get_upload_url",
        arguments: {
          app_grant: appGrant,
          filename: "reference.png",
          content_type: "image/png",
          size: 9,
        },
      })) as { content: Array<{ type: "text"; text: string }> };
      expect(JSON.parse(denied.content[0].text)).toMatchObject({ success: false });

      const minted = (await client.callTool({
        name: "get_upload_url",
        arguments: {
          app_grant: latestGrant,
          filename: "reference.png",
          content_type: "image/png",
          size: 9,
        },
      })) as {
        content: Array<{ type: "text"; text: string }>;
        _meta?: { upload?: { upload_url?: string } };
      };
      expect(minted.content[0].text).not.toContain("/upload/");
      expect(minted.content[0].text).not.toContain("/media/");
      expect(minted._meta?.upload?.upload_url).toContain("/upload/");

      const finalized = (await client.callTool({
        name: "finalize_upload",
        arguments: {
          app_grant: latestGrant,
          media_id: "02a9f79d-cbca-44f8-a93e-10fbe6e76848",
        },
      })) as { content: Array<{ type: "text"; text: string }> };
      expect(JSON.parse(finalized.content[0].text)).toMatchObject({
        success: true,
        download_url: "https://tempfile.redpandaai.co/final.png",
      });
    } finally {
      await client.close();
      await server.close();
      await privateApp.db.close();
      if (previousKey === undefined) delete process.env.KIE_AI_API_KEY;
      else process.env.KIE_AI_API_KEY = previousKey;
      if (previousDb === undefined) delete process.env.KIE_AI_DB_PATH;
      else process.env.KIE_AI_DB_PATH = previousDb;
    }
  });
});

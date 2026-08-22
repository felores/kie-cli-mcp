import { z } from "zod";
import type { ToolDef, ToolContext, ToolResult } from "./types.js";

/**
 * Upload widget tool for MCP Apps (SEP-1865) with universal fallback.
 *
 * This tool declares a UI resource (ui://upload/form.html) that MCP-Apps-capable
 * hosts can render as an inline iframe widget. For clients without MCP Apps
 * support, it also returns a clickable link to open the widget in a browser.
 *
 * Flow (inline widget):
 * 1. Host detects _meta.ui.resourceUri → renders iframe
 * 2. User selects file in widget → widget POSTs to MCP server
 * 3. Server stores file, returns public URL
 * 4. Widget sends tools/call to notify model → model gets URL
 *
 * Flow (fallback link):
 * 1. Client doesn't support MCP Apps → shows the returned markdown link
 * 2. User clicks link → browser opens widget as standalone page
 * 3. User uploads file → gets URL displayed → pastes URL back to chat
 * 4. Model uses the pasted URL in subsequent tool calls
 */
export const UploadWidgetSchema = z.object({
  // No input parameters needed – the widget handles everything
});

export type UploadWidgetRequest = z.infer<typeof UploadWidgetSchema>;

export const uploadWidgetTool: ToolDef<typeof UploadWidgetSchema> = {
  name: "upload_widget",
  description:
    "REQUIRED when the user wants to use an image/file that was attached to the chat but is not accessible as a public URL. " +
    "This tool opens an upload widget where the user can select and upload the file directly. " +
    "After upload, the user receives a public file_url that can be used in other tools (e.g. reference_image_urls, first_frame_url, input_urls). " +
    "IMPORTANT: Do NOT try to access the file via terminal commands or base64. Always use this tool for file uploads. " +
    "The widget auto-closes after upload and copies the URL to the user's clipboard.",
  category: "utility",
  schema: UploadWidgetSchema,
  // MCP Apps: declare the UI resource
  // @ts-expect-error – _meta is part of MCP spec, not in ToolDef type yet
  _meta: {
    ui: {
      resourceUri: "ui://upload/form.html",
      visibility: ["model", "app"],
    },
    // Legacy flat key for older hosts
    "ui/resourceUri": "ui://upload/form.html",
  },
  async run(_args, ctx: ToolContext): Promise<ToolResult> {
    const baseUrl =
      process.env.MCP_PUBLIC_URL || "http://localhost:3000";
    const widgetUrl = `${baseUrl}/ui/upload/form.html`;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              message:
                "I cannot access the file directly from the chat. Please use the upload widget below to upload it. " +
                "The widget will close automatically after upload and copy the URL to your clipboard.",
              widget_url: widgetUrl,
              next_steps:
                "1. Click the link below to open the upload widget. " +
                "2. Select your file and upload it. " +
                "3. The window closes automatically and the URL is copied to your clipboard. " +
                "4. Paste the URL here and I will use it in the next tool call.",
              instructions_for_model:
                "Tell the user: 'Please click this link to upload your file: [📎 Open Upload Widget](" +
                widgetUrl +
                ") — after upload, paste the copied URL here.'",
            },
            null,
            2,
          ),
        },
      ],
    };
  },
};

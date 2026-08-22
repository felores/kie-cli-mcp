import { UploadWidgetSchema } from "../types.js";
import type { ToolContext, ToolDef, ToolResult } from "./types.js";

export const UPLOAD_WIDGET_URI = "ui://kie/upload.html";

export const uploadWidgetTool: ToolDef<typeof UploadWidgetSchema> = {
  name: "upload_widget",
  description:
    "Open a secure file picker for uploading local media. MCP Apps hosts render the inline widget; other clients receive instructions for upload_file.",
  category: "utility",
  schema: UploadWidgetSchema,
  ui: {
    resourceUri: UPLOAD_WIDGET_URI,
    visibility: ["model"],
  },
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      UploadWidgetSchema.parse(args);
      const grant = ctx.createWidgetGrant?.();
      const available = Boolean(ctx.createUploadCapability && grant);
      const result: ToolResult = {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: available,
                widget: UPLOAD_WIDGET_URI,
                message: available
                  ? "Use the rendered upload widget. Capabilities remain outside model-visible content; finalized Kie media is added to context."
                  : "This adapter has no configured temporary HTTP storage. Use upload_file with file_base64 or a CLI-approved file_path.",
              },
              null,
              2,
            ),
          },
        ],
      };
      result._meta = grant ? { upload: { app_grant: grant } } : undefined;
      return result;
    } catch (error) {
      return ctx.formatError("upload_widget", error, {});
    }
  },
};

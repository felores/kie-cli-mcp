import { GetUploadUrlSchema } from "../types.js";
import type { ToolContext, ToolDef, ToolResult } from "./types.js";

export const getUploadUrlTool: ToolDef<typeof GetUploadUrlSchema> = {
  name: "get_upload_url",
  description:
    "Create short-lived capability URLs for a browser or HTTP client to upload media to this MCP server. Available only when Streamable HTTP storage is explicitly configured.",
  category: "utility",
  schema: GetUploadUrlSchema,
  ui: { visibility: ["app"] },
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const request = GetUploadUrlSchema.parse(args);
      if (!ctx.validateWidgetGrant?.(request.app_grant)) {
        throw new Error("Invalid or expired widget grant.");
      }
      if (!ctx.createUploadCapability) {
        throw new Error(
          "Temporary HTTP upload storage is unavailable on this adapter. Use upload_file with file_base64 or a CLI-approved file_path, or run Streamable HTTP with KIE_MCP_PUBLIC_BASE_URL configured.",
        );
      }
      const capability = await ctx.createUploadCapability({
        filename: request.filename,
        contentType: request.content_type,
        size: request.size,
        owner: ctx.approvalContext,
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                media_id: capability.mediaId,
                upload_expires_at: capability.uploadExpiresAt,
                instructions:
                  "The app received a one-use upload capability outside model-visible content. PUT exactly size bytes, then finalize media_id.",
              },
              null,
              2,
            ),
          },
        ],
        structuredContent: { media_id: capability.mediaId },
        _meta: {
          upload: {
            upload_url: capability.uploadUrl,
            media_id: capability.mediaId,
            upload_expires_at: capability.uploadExpiresAt,
          },
        },
      };
    } catch (error) {
      return ctx.formatError("get_upload_url", error, {
        app_grant: "Short-lived grant emitted by upload_widget metadata",
        filename: "Filename without path separators or control characters",
        content_type: "Supported image, video, or audio MIME type",
        size: "Exact size in bytes, maximum 25 MiB",
      });
    }
  },
};

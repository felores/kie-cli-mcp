import { FinalizeUploadSchema } from "../types.js";
import type { ToolContext, ToolDef, ToolResult } from "./types.js";

export const finalizeUploadTool: ToolDef<typeof FinalizeUploadSchema> = {
  name: "finalize_upload",
  description:
    "Finalize staged widget media server-side and upload it to Kie.ai. App-only helper; public capabilities never enter model content.",
  category: "utility",
  schema: FinalizeUploadSchema,
  ui: { visibility: ["app"] },
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const request = FinalizeUploadSchema.parse(args);
      if (!ctx.validateWidgetGrant?.(request.app_grant)) {
        throw new Error("Invalid or expired widget grant.");
      }
      if (!ctx.finalizeUpload) {
        throw new Error("Temporary HTTP upload finalization is unavailable.");
      }
      const finalized = await ctx.finalizeUpload({
        mediaId: request.media_id,
        owner: ctx.approvalContext,
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                download_url: finalized.downloadUrl,
                filename: finalized.filename,
                content_type: finalized.contentType,
                size: finalized.size,
                retention: "Temporary Kie URL; consume promptly.",
              },
              null,
              2,
            ),
          },
        ],
        structuredContent: {
          download_url: finalized.downloadUrl,
          filename: finalized.filename,
          content_type: finalized.contentType,
          size: finalized.size,
        },
      };
    } catch (error) {
      return ctx.formatError("finalize_upload", error, {
        app_grant: "Short-lived grant emitted by upload_widget metadata",
        media_id: "Opaque media ID returned by get_upload_url",
      });
    }
  },
};

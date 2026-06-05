import { Veo3Get1080pVideoSchema } from "../types.js";
import type { ToolDef, ToolContext, ToolResult } from "./types.js";

export const veo3Get1080pVideoTool: ToolDef<typeof Veo3Get1080pVideoSchema> = {
  name: "veo3_get_1080p_video",
  description:
    "Get 1080P high-definition version of a Veo3 video (not available for fallback mode videos)",
  category: "video",
  schema: Veo3Get1080pVideoSchema,
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const { task_id, index } = Veo3Get1080pVideoSchema.parse(args);

      const response = await ctx.client.getVeo1080pVideo(task_id, index);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                task_id: task_id,
                response: response,
                message: "Retrieved 1080p video URL",
                note: "Not available for videos generated with fallback mode",
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      return ctx.formatError("veo3_get_1080p_video", error, {
        task_id: "Required: Veo3 task ID to get 1080p video for",
        index: "Optional: video index (for multiple video results)",
      });
    }
  },
};

import { WanImageSchema } from "../types.js";
import type { ToolDef } from "./types.js";

export const wanImageTool: ToolDef<typeof WanImageSchema> = {
  name: "wan_image",
  description:
    "Generate and edit images using Wan 2.7 Image or Image Pro, with up to 9 references, sequential output, color palettes, and bounding-box editing.",
  category: "image",
  schema: WanImageSchema,
  async run(args, ctx) {
    try {
      const request = WanImageSchema.parse(args);
      request.callBackUrl = ctx.getCallbackUrl(request.callBackUrl);
      const response = await ctx.client.generateWanImage(request);
      if (response.code !== 200 || !response.data?.taskId)
        throw new Error(response.msg || "Failed to create Wan image task");
      await ctx.db.createTask({
        task_id: response.data.taskId,
        api_type: "wan-image",
        status: "pending",
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                task_id: response.data.taskId,
                message: "Wan 2.7 image task created successfully",
                parameters: {
                  model: request.model,
                  mode: request.input_urls?.length
                    ? "image-to-image"
                    : "text-to-image",
                  n: request.n ?? (request.enable_sequential ? 12 : 4),
                  resolution: request.resolution,
                },
                next_steps: [
                  "Use get_task_status or wait_for_task with this task_id",
                ],
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      return ctx.formatError("wan_image", error, {
        prompt: "Required: up to 5000 characters",
        model: "wan/2-7-image or wan/2-7-image-pro",
        input_urls: "Optional: 1-9 images for editing",
        n: "1-4 in standard mode, 1-12 in sequential mode",
        bbox_list: "One bounding-box list per input image",
      });
    }
  },
};

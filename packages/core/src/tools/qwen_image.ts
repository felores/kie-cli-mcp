import { QwenImageSchema } from "../types.js";
import type { ToolDef } from "./types.js";

export const qwenImageTool: ToolDef<typeof QwenImageSchema> = {
  name: "qwen_image",
  description:
    "Generate and edit images using Qwen3 or Qwen3 Pro. image_urls selects editing with up to 3 references. Supports 1K/2K, prompt rewriting, and PNG/JPEG. Older versions are removed.",
  category: "image",
  schema: QwenImageSchema,
  async run(args, ctx) {
    try {
      const request = QwenImageSchema.parse(args);
      request.callBackUrl = ctx.getCallbackUrl(request.callBackUrl);
      const response = await ctx.client.generateQwenImage(request);
      if (response.code !== 200 || !response.data?.taskId)
        throw new Error(response.msg || "Failed to create Qwen3 task");
      await ctx.db.createTask({
        task_id: response.data.taskId,
        api_type: "qwen-image",
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
                message: `Qwen3 ${request.image_urls?.length ? "Image-to-Image" : "Text-to-Image"} task created successfully`,
                parameters: {
                  model: request.model,
                  image_size: request.image_size,
                  resolution: request.resolution,
                  output_format: request.output_format,
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
      return ctx.formatError("qwen_image", error, {
        model: "qwen3 (default) or qwen3-pro",
        prompt: "Required: positive prompt, up to 5000 characters",
        image_urls: "Optional: 1-3 image URLs for editing",
        image_size: "Supported aspect ratio, default 16:9",
        resolution: "1K (default) or 2K",
      });
    }
  },
};

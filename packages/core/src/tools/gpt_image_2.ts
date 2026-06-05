import { z } from "zod";
import { GptImage2Schema } from "../types.js";
import type { ToolDef, ToolContext, ToolResult } from "./types.js";

export const gptImage2Tool: ToolDef<typeof GptImage2Schema> = {
  name: "gpt_image_2",
  description: "Generate images using GPT Image 2 (text-to-image and image-to-image with up to 16 reference images)",
  category: "image",
  schema: GptImage2Schema,
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const request = GptImage2Schema.parse(args);
      request.callBackUrl = ctx.getCallbackUrl(request.callBackUrl);

      const response = await ctx.client.generateGptImage2(request);

      if (response.code === 200 && response.data?.taskId) {
        const mode = request.input_urls?.length
          ? "Image-to-Image"
          : "Text-to-Image";

        await ctx.db.createTask({
          task_id: response.data.taskId,
          api_type: "gpt-image-2",
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
                  message: `GPT Image 2 ${mode} task created successfully`,
                  parameters: {
                    mode,
                    prompt:
                      request.prompt.substring(0, 100) +
                      (request.prompt.length > 100 ? "..." : ""),
                    aspect_ratio: request.aspect_ratio || "auto",
                    resolution: request.resolution || "1K",
                    ...(request.input_urls && {
                      input_urls: request.input_urls,
                    }),
                  },
                  next_steps: [
                    `Use get_task_status with task_id: ${response.data.taskId} to check progress`,
                    'Generated images will be available when status is "completed"',
                  ],
                },
                null,
                2,
              ),
            },
          ],
        };
      } else {
        throw new Error(response.msg || "Failed to create GPT Image 2 task");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return ctx.formatError("gpt_image_2", error, {
          prompt:
            "Required: Text prompt describing the desired image (max 20000 chars)",
          input_urls:
            "Optional: Array of up to 16 image URLs for image-to-image mode",
          aspect_ratio:
            "Optional: auto, 1:1, 9:16, 16:9, 4:3, 3:4 (default: auto)",
          resolution: "Optional: 1K, 2K, 4K (default: 1K)",
        });
      }
      return ctx.formatError("gpt_image_2", error, {
        prompt:
          "Required: Text prompt describing the desired image (max 20000 chars)",
        input_urls:
          "Optional: Array of up to 16 image URLs for image-to-image mode",
        aspect_ratio:
          "Optional: auto, 1:1, 9:16, 16:9, 4:3, 3:4 (default: auto)",
        resolution: "Optional: 1K, 2K, 4K (default: 1K)",
      });
    }
  },
};

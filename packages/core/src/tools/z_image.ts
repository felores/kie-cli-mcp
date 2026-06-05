import { z } from "zod";
import { ZImageSchema } from "../types.js";
import type { ToolDef, ToolContext, ToolResult } from "./types.js";

export const zImageTool: ToolDef<typeof ZImageSchema> = {
  name: "z_image",
  description: "Generate photorealistic images using Tongyi-MAI Z-Image model. Ultra-fast Turbo performance, accurate bilingual text rendering (Chinese/English), strong semantic understanding. Pricing: ~$0.004/image",
  category: "image",
  schema: ZImageSchema,
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const request = ZImageSchema.parse(args);

      // Use intelligent callback URL fallback
      request.callBackUrl = ctx.getCallbackUrl(request.callBackUrl);

      const response = await ctx.client.generateZImage(request);

      if (response.code === 200 && response.data?.taskId) {
        // Store task in database
        await ctx.db.createTask({
          task_id: response.data.taskId,
          api_type: "z-image",
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
                  message: "Z-Image generation task created successfully",
                  parameters: {
                    prompt:
                      request.prompt.substring(0, 100) +
                      (request.prompt.length > 100 ? "..." : ""),
                    aspect_ratio: request.aspect_ratio || "1:1",
                  },
                  pricing: "~$0.004 per image (0.8 credits)",
                  next_steps: [
                    `Use get_task_status with task_id: ${response.data.taskId} to check progress`,
                    'Generated image will be available when status is "completed"',
                  ],
                },
                null,
                2,
              ),
            },
          ],
        };
      } else {
        throw new Error(response.msg || "Failed to create Z-Image task");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return ctx.formatError("z_image", error, {
          prompt:
            "Required: Text prompt describing the desired image (max 5000 chars)",
          aspect_ratio:
            "Optional: Aspect ratio (1:1, 4:3, 3:4, 16:9, 9:16, default: 1:1)",
          callBackUrl: "Optional: URL for task completion notifications",
        });
      }

      return ctx.formatError("z_image", error, {
        prompt:
          "Required: Text prompt describing the desired image (max 5000 chars)",
        aspect_ratio:
          "Optional: Aspect ratio (1:1, 4:3, 3:4, 16:9, 9:16, default: 1:1)",
        callBackUrl: "Optional: URL for task completion notifications",
      });
    }
  },
};

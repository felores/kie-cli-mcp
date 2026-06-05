import { z } from "zod";
import { TopazUpscaleImageSchema } from "../types.js";
import type { ToolDef, ToolContext, ToolResult } from "./types.js";

export const topazUpscaleImageTool: ToolDef<typeof TopazUpscaleImageSchema> = {
  name: "topaz_upscale_image",
  description: "Upscale and enhance images using Topaz Labs AI upscaler. Increases resolution with high-fidelity detail restoration, natural texture reconstruction, and improved clarity. Supports 1x-8x upscaling (max output 20,000px per side). Pricing: 10 credits (≤2K), 20 credits (4K), 40 credits (8K).",
  category: "image",
  schema: TopazUpscaleImageSchema,
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const request = TopazUpscaleImageSchema.parse(args);

      // Use intelligent callback URL fallback
      request.callBackUrl = ctx.getCallbackUrl(request.callBackUrl);

      const response = await ctx.client.generateTopazUpscaleImage(request);

      if (response.code === 200 && response.data?.taskId) {
        // Store task in database
        await ctx.db.createTask({
          task_id: response.data.taskId,
          api_type: "topaz-upscale",
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
                  message: "Topaz Image Upscale task created successfully",
                  parameters: {
                    image_url: request.image_url,
                    upscale_factor: request.upscale_factor,
                    callBackUrl: request.callBackUrl,
                  },
                  next_steps: [
                    "Use get_task_status to check generation progress",
                    "Task completion will be sent to the provided callback URL",
                    "Upscaling typically takes 30-90 seconds depending on image size and upscale factor",
                  ],
                },
                null,
                2,
              ),
            },
          ],
        };
      } else {
        throw new Error(
          response.msg || "Failed to create Topaz Image Upscale task",
        );
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return ctx.formatError("topaz_upscale_image", error, {
          image_url:
            "Required: URL of image to upscale (JPEG, PNG, WEBP, max 10MB)",
          upscale_factor:
            'Optional: Upscale factor "1", "2" (default), "4", or "8". Max output dimension is 20,000px.',
          callBackUrl:
            "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
        });
      }

      return ctx.formatError("topaz_upscale_image", error, {
        image_url: "Required: URL of image to upscale",
        upscale_factor: 'Optional: Upscale factor "1", "2", "4", or "8"',
        callBackUrl: "Optional: URL for task completion notifications",
      });
    }
  },
};

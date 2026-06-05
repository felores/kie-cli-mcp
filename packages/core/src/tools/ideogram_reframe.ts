import { z } from "zod";
import { IdeogramReframeSchema } from "../types.js";
import type { ToolDef, ToolContext, ToolResult } from "./types.js";

export const ideogramReframeTool: ToolDef<typeof IdeogramReframeSchema> = {
  name: "ideogram_reframe",
  description: "Reframe images to different aspect ratios and sizes using Ideogram V3 Reframe model",
  category: "image",
  schema: IdeogramReframeSchema,
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const request = IdeogramReframeSchema.parse(args);

      // Use intelligent callback URL fallback
      request.callBackUrl = ctx.getCallbackUrl(request.callBackUrl);

      const response = await ctx.client.generateIdeogramReframe(request);

      if (response.code === 200 && response.data?.taskId) {
        // Store task in database
        await ctx.db.createTask({
          task_id: response.data.taskId,
          api_type: "ideogram-reframe",
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
                  message: "Ideogram V3 Reframe task created successfully",
                  parameters: {
                    image_url: request.image_url,
                    image_size: request.image_size,
                    rendering_speed: request.rendering_speed,
                    style: request.style,
                    num_images: request.num_images,
                    seed: request.seed,
                    callBackUrl: request.callBackUrl,
                  },
                  next_steps: [
                    "Use get_task_status to check generation progress",
                    "Task completion will be sent to the provided callback URL",
                    "Image reframing typically takes 30-120 seconds depending on complexity and settings",
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
          response.msg || "Failed to create Ideogram V3 Reframe task",
        );
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return ctx.formatError("ideogram_reframe", error, {
          image_url:
            "Required: URL of image to reframe (JPEG, PNG, WEBP, max 10MB)",
          image_size:
            "Required: Output size (square, square_hd, portrait_4_3, portrait_16_9, landscape_4_3, landscape_16_9)",
          rendering_speed:
            "Optional: Rendering speed (TURBO, BALANCED, QUALITY) - default: BALANCED",
          style:
            "Optional: Style type (AUTO, GENERAL, REALISTIC, DESIGN) - default: AUTO",
          num_images: "Optional: Number of images (1, 2, 3, 4) - default: 1",
          seed: "Optional: Seed for reproducible results (default: 0)",
          callBackUrl:
            "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
        });
      }

      return ctx.formatError("ideogram_reframe", error, {
        image_url: "Required: URL of image to reframe",
        image_size: "Required: Output size for the reframed image",
        rendering_speed: "Optional: Rendering speed preference",
        style: "Optional: Style type for generation",
        num_images: "Optional: Number of images to generate",
        seed: "Optional: Seed for reproducible results",
        callBackUrl: "Optional: URL for task completion notifications",
      });
    }
  },
};

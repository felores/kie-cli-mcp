import { z } from "zod";
import { ByteDanceSeedreamImageSchema } from "../types.js";
import type { ToolDef, ToolContext, ToolResult } from "./types.js";

export const bytedanceSeedreamImageTool: ToolDef<typeof ByteDanceSeedreamImageSchema> = {
  name: "bytedance_seedream_image",
  description: "Generate and edit images using ByteDance Seedream models (supports V4 and V5 Lite with 3K output). V5 Lite offers enhanced detail fidelity, multi-image fusion up to 14 refs, and clear small-text rendering",
  category: "image",
  schema: ByteDanceSeedreamImageSchema,
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const request = ByteDanceSeedreamImageSchema.parse(args);

      // Use intelligent callback URL fallback
      request.callBackUrl = ctx.getCallbackUrl(request.callBackUrl);

      const response =
        await ctx.client.generateByteDanceSeedreamImage(request);

      if (response.code === 200 && response.data?.taskId) {
        // Determine mode for user feedback
        const isEdit = !!request.image_urls && request.image_urls.length > 0;
        const mode = isEdit ? "Image Editing" : "Text-to-Image";

        // Store task in database
        await ctx.db.createTask({
          task_id: response.data.taskId,
          api_type: "bytedance-seedream-image",
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
                  message: `ByteDance Seedream ${request.version === "4" ? "V4" : "V5 Lite"} ${mode} task created successfully`,
                  parameters: {
                    mode: mode,
                    prompt:
                      request.prompt.substring(0, 100) +
                      (request.prompt.length > 100 ? "..." : ""),
                    image_size: request.image_size || "1:1",
                    image_resolution: request.image_resolution || "1K",
                    max_images: request.max_images || 1,
                    seed: request.seed !== undefined ? request.seed : -1,
                    ...(isEdit && {
                      image_urls_count: request.image_urls?.length || 0,
                    }),
                  },
                  next_steps: [
                    `Use get_task_status with task_id: ${response.data.taskId} to check progress`,
                    'Generated images will be available when status is "completed"',
                  ],
                  usage_examples: [
                    `get_task_status: {"task_id": "${response.data.taskId}"}`,
                    `list_tasks: {"limit": 10}`,
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
          response.msg || "Failed to create ByteDance Seedream image task",
        );
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return ctx.formatError("bytedance_seedream_image", error, {
          prompt:
            "Required: Text prompt for image generation or editing (max 10000 characters)",
          image_urls:
            "Optional: Array of image URLs for editing mode (1-10 images)",
          image_size: "Optional: Image aspect ratio (default: 1:1)",
          image_resolution:
            "Optional: Image resolution - 1K/2K/4K (default: 1K)",
          max_images:
            "Optional: Number of images to generate (1-6, default: 1)",
          seed: "Optional: Random seed for reproducible results (default: -1 for random)",
          callBackUrl:
            "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
        });
      }

      return ctx.formatError("bytedance_seedream_image", error, {
        prompt:
          "Required: Text prompt for image generation or editing (max 10000 characters)",
        image_urls:
          "Optional: Array of image URLs for editing mode (1-10 images)",
        image_size: "Optional: Image aspect ratio (default: 1:1)",
        image_resolution: "Optional: Image resolution - 1K/2K/4K (default: 1K)",
        max_images: "Optional: Number of images to generate (1-6, default: 1)",
        seed: "Optional: Random seed for reproducible results (default: -1 for random)",
        callBackUrl:
          "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
      });
    }
  },
};

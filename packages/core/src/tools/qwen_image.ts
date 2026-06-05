import { z } from "zod";
import { QwenImageSchema } from "../types.js";
import type { ToolDef, ToolContext, ToolResult } from "./types.js";

export const qwenImageTool: ToolDef<typeof QwenImageSchema> = {
  name: "qwen_image",
  description: "Generate and edit images using Qwen models (unified tool for both text-to-image and image editing)",
  category: "image",
  schema: QwenImageSchema,
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const request = QwenImageSchema.parse(args);

      // Use intelligent callback URL fallback
      request.callBackUrl = ctx.getCallbackUrl(request.callBackUrl);

      const response = await ctx.client.generateQwenImage(request);

      if (response.code === 200 && response.data?.taskId) {
        // Determine mode for user feedback
        const isEdit = !!request.image_url;
        const mode = isEdit ? "Image Editing" : "Text-to-Image";

        // Store task in database
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
                  message: `Qwen ${mode} task created successfully`,
                  parameters: {
                    mode: mode,
                    prompt:
                      request.prompt.substring(0, 100) +
                      (request.prompt.length > 100 ? "..." : ""),
                    image_size: request.image_size || "square_hd",
                    num_inference_steps:
                      request.num_inference_steps || (isEdit ? 25 : 30),
                    guidance_scale:
                      request.guidance_scale || (isEdit ? 4 : 2.5),
                    enable_safety_checker:
                      request.enable_safety_checker !== false,
                    output_format: request.output_format || "png",
                    negative_prompt:
                      request.negative_prompt ||
                      (isEdit ? "blurry, ugly" : " "),
                    acceleration: request.acceleration || "none",
                    seed: request.seed,
                    ...(isEdit && {
                      image_url: request.image_url,
                      num_images: request.num_images,
                      sync_mode: request.sync_mode,
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
        throw new Error(response.msg || "Failed to create Qwen image task");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return ctx.formatError("qwen_image", error, {
          prompt: "Required: Text prompt for image generation or editing",
          image_url: "Optional: URL of image to edit (required for edit mode)",
          image_size:
            "Optional: Image size (square, square_hd, portrait_4_3, portrait_16_9, landscape_4_3, landscape_16_9)",
          num_inference_steps:
            "Optional: Number of inference steps (2-250 for text-to-image, 2-49 for edit)",
          guidance_scale:
            "Optional: CFG scale (0-20, default: 2.5 for text-to-image, 4 for edit)",
          enable_safety_checker:
            "Optional: Enable safety checker (default: true)",
          output_format: "Optional: Output format (png/jpeg, default: png)",
          negative_prompt: "Optional: Negative prompt (max 500 chars)",
          acceleration:
            "Optional: Acceleration level (none/regular/high, default: none)",
          num_images: "Optional: Number of images (1-4, edit mode only)",
          sync_mode: "Optional: Sync mode (edit mode only)",
          seed: "Optional: Random seed for reproducible results",
          callBackUrl:
            "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
        });
      }

      return ctx.formatError("qwen_image", error, {
        prompt: "Required: Text prompt for image generation or editing",
        image_url: "Optional: URL of image to edit (required for edit mode)",
        image_size:
          "Optional: Image size (square, square_hd, portrait_4_3, portrait_16_9, landscape_4_3, landscape_16_9)",
        num_inference_steps:
          "Optional: Number of inference steps (2-250 for text-to-image, 2-49 for edit)",
        guidance_scale:
          "Optional: CFG scale (0-20, default: 2.5 for text-to-image, 4 for edit)",
        enable_safety_checker:
          "Optional: Enable safety checker (default: true)",
        output_format: "Optional: Output format (png/jpeg, default: png)",
        negative_prompt: "Optional: Negative prompt (max 500 chars)",
        acceleration:
          "Optional: Acceleration level (none/regular/high, default: none)",
        num_images: "Optional: Number of images (1-4, edit mode only)",
        sync_mode: "Optional: Sync mode (edit mode only)",
        seed: "Optional: Random seed for reproducible results",
        callBackUrl:
          "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
      });
    }
  },
};

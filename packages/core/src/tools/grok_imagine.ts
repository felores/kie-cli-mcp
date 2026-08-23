import { z } from "zod";
import { GrokImagineSchema } from "../types.js";
import type { ToolContext, ToolDef, ToolResult } from "./types.js";

export const grokImagineTool: ToolDef<typeof GrokImagineSchema> = {
  name: "grok_imagine",
  description:
    "Generate images and videos using xAI's Grok Imagine (5 modes: Image 2.0 text-to-image, Image 2.0 image-to-image, text-to-video, image-to-video, upscale). Supports synchronized audio with video.",
  category: "video",
  schema: GrokImagineSchema,
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const request = GrokImagineSchema.parse(args);

      // Use intelligent callback URL fallback
      request.callBackUrl = ctx.getCallbackUrl(request.callBackUrl);

      const response = await ctx.client.generateGrokImagine(request);

      if (response.code === 200 && response.data?.taskId) {
        // Detect which mode was used for logging
        const hasImageUrls =
          request.image_urls && request.image_urls.length > 0;
        const hasTaskId = !!request.task_id;
        const hasPrompt = !!request.prompt;
        const detectedMode =
          request.generation_mode ||
          (hasTaskId && !hasPrompt && !hasImageUrls
            ? "upscale"
            : hasImageUrls || hasTaskId
              ? "image-to-video"
              : "text-to-video");

        // Store task in database
        await ctx.db.createTask({
          task_id: response.data.taskId,
          api_type: "grok-imagine",
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
                  message: `Grok Imagine ${detectedMode} task created successfully`,
                  parameters: {
                    mode: detectedMode,
                    prompt: request.prompt
                      ? request.prompt.substring(0, 100) +
                        (request.prompt.length > 100 ? "..." : "")
                      : undefined,
                    aspect_ratio:
                      detectedMode === "text-to-image" ||
                      detectedMode === "image-to-image"
                        ? request.aspect_ratio || "1:1"
                        : request.aspect_ratio,
                    style_mode:
                      detectedMode === "text-to-video" ||
                      detectedMode === "image-to-video"
                        ? request.mode || "normal"
                        : undefined,
                  },
                  pricing: "unknown: no verified local rate-card formula",
                  next_steps: [
                    `Use get_task_status with task_id: ${response.data.taskId} to check progress`,
                    'Generated content will be available when status is "completed"',
                  ],
                },
                null,
                2,
              ),
            },
          ],
        };
      } else {
        throw new Error(response.msg || "Failed to create Grok Imagine task");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return ctx.formatError("grok_imagine", error, {
          prompt:
            "Text prompt (required for text modes, optional for image-to-video)",
          image_urls:
            "One image URL for image-to-video, or one to five for explicit image-to-image",
          task_id: "Task ID for upscale or image-to-video from generated image",
          index: "Image index (0-5) when using task_id",
          aspect_ratio:
            "Image 2.0 image modes default to 1:1. text-to-image: 1:1, 2:3, 3:2, 16:9, or 9:16; image-to-image also accepts auto",
          mode: "Video style mode: fun, normal, or spicy",
          generation_mode:
            "Explicit mode: text-to-image, image-to-image, text-to-video, image-to-video, upscale",
        });
      }

      return ctx.formatError("grok_imagine", error, {
        prompt:
          "Text prompt (required for text modes, optional for image-to-video)",
        generation_mode:
          "Explicit mode: text-to-image, image-to-image, text-to-video, image-to-video, upscale",
      });
    }
  },
};

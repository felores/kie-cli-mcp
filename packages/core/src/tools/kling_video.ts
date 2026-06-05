import { z } from "zod";
import { KlingVideoSchema } from "../types.js";
import type { ToolDef, ToolContext, ToolResult } from "./types.js";

export const klingVideoTool: ToolDef<typeof KlingVideoSchema> = {
  name: "kling_video",
  description:
    "Generate videos using Kling 3.0 AI - supports 3-15s flexible duration, native multilingual audio, multi-shot storytelling, character elements, and std/pro quality modes",
  category: "video",
  schema: KlingVideoSchema,
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const request = KlingVideoSchema.parse(args);

      // Use intelligent callback URL fallback
      request.callBackUrl = ctx.getCallbackUrl(request.callBackUrl);

      const response = await ctx.client.generateKlingVideo(request);

      // Determine mode description
      const hasImages = !!request.image_urls && request.image_urls.length > 0;
      const modeDescription = request.multi_shots
        ? "Kling 3.0 multi-shot"
        : hasImages
          ? "Kling 3.0 image-to-video"
          : "Kling 3.0 text-to-video";

      if (response.code === 200 && response.data?.taskId) {
        await ctx.db.createTask({
          task_id: response.data.taskId,
          api_type: "kling-3.0-video",
          status: "pending",
        });
      } else {
        throw new Error(
          response.msg || "Failed to create Kling 3.0 video task",
        );
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                task_id: response.data?.taskId,
                mode: modeDescription,
                message: `Kling 3.0 video generation task created successfully (${modeDescription})`,
                parameters: {
                  prompt: request.prompt,
                  duration: request.duration || "5",
                  aspect_ratio: request.aspect_ratio || "16:9",
                  mode: request.mode || "std",
                  sound: request.sound ?? false,
                  multi_shots: request.multi_shots ?? false,
                  callBackUrl: request.callBackUrl,
                },
                next_steps: [
                  "Use get_task_status to check generation progress",
                  "Task completion will be sent to the provided callback URL",
                  "Video generation typically takes 1-5 minutes depending on duration and complexity",
                ],
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return ctx.formatError("kling_video", error, {
          prompt: "Required: video description (max 5000 chars)",
          image_urls: "Optional: up to 2 image URLs (start frame, end frame)",
          duration: 'Optional: video duration "3"-"15" (default: "5")',
          aspect_ratio:
            'Optional: aspect ratio "16:9", "9:16", or "1:1" (default: "16:9")',
          mode: 'Optional: "std" or "pro" (default: "std")',
          sound: "Optional: enable native audio (default: false)",
          multi_shots:
            "Optional: enable multi-shot mode (requires multi_prompt)",
          multi_prompt:
            "Optional: array of {prompt, duration} for multi-shot scenes",
          kling_elements:
            "Optional: character/object elements for identity consistency",
          callBackUrl:
            "Optional: callback URL (uses KIE_AI_CALLBACK_URL env var if not provided)",
        });
      }

      return ctx.formatError("kling_video", error, {
        prompt: "Required: text description for video generation",
        image_urls: "Optional: up to 2 image URLs for image-to-video",
        duration: "Optional: video duration 3-15 seconds",
        aspect_ratio: "Optional: aspect ratio (16:9, 9:16, 1:1)",
        mode: "Optional: quality mode (std or pro)",
        sound: "Optional: enable native audio generation",
        callBackUrl: "Optional: URL for task completion notifications",
      });
    }
  },
};

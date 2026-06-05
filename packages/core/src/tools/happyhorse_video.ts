import { z } from "zod";
import { HappyHorseVideoSchema } from "../types.js";
import type { ToolDef, ToolContext, ToolResult } from "./types.js";

export const happyhorseVideoTool: ToolDef<typeof HappyHorseVideoSchema> = {
  name: "happyhorse_video",
  description: "Generate videos using Alibaba HappyHorse 1.0 (text-to-video, image-to-video, reference-to-video with up to 9 images, video-edit with native audio)",
  category: "video",
  schema: HappyHorseVideoSchema,
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const request = HappyHorseVideoSchema.parse(args);
      request.callBackUrl = ctx.getCallbackUrl(request.callBackUrl);

      const response = await ctx.client.generateHappyHorseVideo(request);

      if (response.code === 200 && response.data?.taskId) {
        const mode =
          request.mode ||
          (request.video_url
            ? "video-edit"
            : request.reference_image?.length
              ? "reference-to-video"
              : request.image_urls?.length
                ? "image-to-video"
                : "text-to-video");

        await ctx.db.createTask({
          task_id: response.data.taskId,
          api_type: "happyhorse-video",
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
                  message: `HappyHorse 1.0 ${mode} task created successfully`,
                  parameters: {
                    mode,
                    prompt:
                      request.prompt.substring(0, 100) +
                      (request.prompt.length > 100 ? "..." : ""),
                    resolution: request.resolution || "1080p",
                    aspect_ratio: request.aspect_ratio || "16:9",
                    duration: request.duration || 5,
                  },
                  next_steps: [
                    `Use get_task_status with task_id: ${response.data.taskId} to check progress`,
                    'Video will be available when status is "completed"',
                  ],
                },
                null,
                2,
              ),
            },
          ],
        };
      } else {
        throw new Error(response.msg || "Failed to create HappyHorse task");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return ctx.formatError("happyhorse_video", error, {
          prompt: "Required: Text prompt for video generation (max 5000 chars)",
          mode: "Optional: text-to-video, image-to-video, reference-to-video, video-edit",
          image_urls: "I2V: Single image URL",
          reference_image: "R2V: Up to 9 reference image URLs",
          video_url: "Video Edit: Video URL to edit",
        });
      }
      return ctx.formatError("happyhorse_video", error, {
        prompt: "Required: Text prompt for video generation (max 5000 chars)",
        mode: "Optional: text-to-video, image-to-video, reference-to-video, video-edit",
      });
    }
  },
};

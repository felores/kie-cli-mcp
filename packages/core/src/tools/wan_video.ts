import { z } from "zod";
import { Wan27VideoSchema } from "../types.js";
import type { ToolDef, ToolContext, ToolResult } from "./types.js";

export const wanVideoTool: ToolDef<typeof Wan27VideoSchema> = {
  name: "wan_video",
  description: "Generate videos using Alibaba Wan 2.7 (text-to-video, image-to-video, reference-to-video, video-edit with native audio support)",
  category: "video",
  schema: Wan27VideoSchema,
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const request = Wan27VideoSchema.parse(args);
      request.callBackUrl = ctx.getCallbackUrl(request.callBackUrl);

      const response = await ctx.client.generateWanVideo(request);

      if (response.code === 200 && response.data?.taskId) {
        const mode =
          request.mode ||
          (request.video_url_edit
            ? "video-edit"
            : request.reference_image?.length || request.reference_video?.length
              ? "reference-to-video"
              : request.first_frame_url ||
                  request.last_frame_url ||
                  request.first_clip_url
                ? "image-to-video"
                : "text-to-video");

        await ctx.db.createTask({
          task_id: response.data.taskId,
          api_type: "wan-video",
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
                  message: `Wan 2.7 ${mode} task created successfully`,
                  parameters: {
                    mode,
                    prompt:
                      request.prompt.substring(0, 100) +
                      (request.prompt.length > 100 ? "..." : ""),
                    resolution: request.resolution || "1080p",
                    ratio: request.ratio || "16:9",
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
        throw new Error(response.msg || "Failed to create Wan 2.7 video task");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return ctx.formatError("wan_video", error, {
          prompt: "Required: Text prompt for video generation (max 5000 chars)",
          mode: "Optional: text-to-video, image-to-video, reference-to-video, video-edit",
          first_frame_url: "I2V: First frame image URL",
          last_frame_url: "I2V: Last frame image URL",
          reference_image: "R2V: Up to 5 reference image URLs",
          video_url_edit: "Video Edit: Video URL to edit",
        });
      }
      return ctx.formatError("wan_video", error, {
        prompt: "Required: Text prompt for video generation",
        mode: "Optional: text-to-video, image-to-video, reference-to-video, video-edit",
      });
    }
  },
};

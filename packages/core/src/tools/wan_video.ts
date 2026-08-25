import { z } from "zod";
import { Wan30VideoSchema } from "../types.js";
import type { ToolContext, ToolDef, ToolResult } from "./types.js";

export const wanVideoTool: ToolDef<typeof Wan30VideoSchema> = {
  name: "wan_video",
  description:
    "Generate videos using Alibaba Wan 3.0 with text, first/last frames, images, videos, audio, documents, or webpage references",
  category: "video",
  schema: Wan30VideoSchema,
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const request = Wan30VideoSchema.parse(args);
      request.callBackUrl = ctx.getCallbackUrl(request.callBackUrl);

      const response = await ctx.client.generateWanVideo(request);

      if (response.code === 200 && response.data?.taskId) {
        const mode = request.reference_file_urls?.length
          ? "file-to-video"
          : request.reference_link_urls?.length
            ? "link-to-video"
            : request.reference_image_urls?.length ||
                request.reference_video_urls?.length ||
                request.reference_audio_urls?.length
              ? "reference-to-video"
              : request.first_frame_url
                ? "image-to-video"
                : "text-to-video";

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
                  message: `Wan 3.0 ${mode} task created successfully`,
                  parameters: {
                    mode,
                    prompt:
                      request.prompt &&
                      request.prompt.substring(0, 100) +
                        (request.prompt.length > 100 ? "..." : ""),
                    resolution: request.resolution || "1080P",
                    aspect_ratio: request.aspect_ratio || "adaptive",
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
        throw new Error(response.msg || "Failed to create Wan 3.0 video task");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return ctx.formatError("wan_video", error, {
          prompt: "Text prompt for generation (max 20000 chars)",
          first_frame_url: "Optional first-frame image URL",
          last_frame_url:
            "Optional last-frame image URL; requires first_frame_url",
          reference_image_urls: "Up to 10 reference image URLs",
          reference_video_urls: "Up to 5 reference video URLs",
          reference_audio_urls: "Up to 5 reference audio URLs",
        });
      }
      return ctx.formatError("wan_video", error, {
        prompt: "Provide a prompt or supported media reference",
      });
    }
  },
};

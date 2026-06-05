import { z } from "zod";
import { ByteDanceSeedanceVideoSchema } from "../types.js";
import type { ToolDef, ToolContext, ToolResult } from "./types.js";

export const bytedanceSeedanceVideoTool: ToolDef<typeof ByteDanceSeedanceVideoSchema> = {
  name: "bytedance_seedance_video",
  description: "Generate videos with ByteDance Seedance 2.0: multimodal inputs (image/video/audio references), native audio generation, standard and fast modes",
  category: "video",
  schema: ByteDanceSeedanceVideoSchema,
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const request = ByteDanceSeedanceVideoSchema.parse(args);

      // Use intelligent callback URL fallback
      request.callBackUrl = ctx.getCallbackUrl(request.callBackUrl);

      const response =
        await ctx.client.generateByteDanceSeedanceVideo(request);

      if (response.code === 200 && response.data?.taskId) {
        const mode = request.mode || "standard";
        const hasFrameInput = !!request.first_frame_url;

        // Store task in database
        await ctx.db.createTask({
          task_id: response.data.taskId,
          api_type: "bytedance-seedance-video",
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
                  message: `ByteDance Seedance 2.0 ${mode} generation task created successfully`,
                  parameters: {
                    mode,
                    prompt:
                      request.prompt.substring(0, 100) +
                      (request.prompt.length > 100 ? "..." : ""),
                    aspect_ratio: request.aspect_ratio || "16:9",
                    resolution: request.resolution || "720p",
                    duration: request.duration || 5,
                    generate_audio: request.generate_audio !== false,
                    ...(hasFrameInput && {
                      first_frame_url: request.first_frame_url,
                    }),
                    ...(request.last_frame_url && {
                      last_frame_url: request.last_frame_url,
                    }),
                    ...(request.reference_image_urls?.length && {
                      reference_images: request.reference_image_urls.length,
                    }),
                    ...(request.reference_video_urls?.length && {
                      reference_videos: request.reference_video_urls.length,
                    }),
                    ...(request.reference_audio_urls?.length && {
                      reference_audios: request.reference_audio_urls.length,
                    }),
                  },
                  next_steps: [
                    "Use get_task_status to check generation progress",
                    "Task completion will be sent to the provided callback URL",
                    `${mode} mode generation typically takes 2-5 minutes depending on duration and complexity`,
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
          response.msg ||
            "Failed to create ByteDance Seedance video generation task",
        );
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return ctx.formatError("bytedance_seedance_video", error, {
          prompt:
            "Required: Text prompt for video generation (3-20000 characters)",
          mode: 'Optional: Generation mode: "standard" or "fast" (default: standard)',
          first_frame_url: "Optional: URL of image to use as first frame",
          last_frame_url: "Optional: URL of image to use as last frame",
          reference_image_urls:
            "Optional: Reference images for style guidance (up to 9)",
          reference_video_urls:
            "Optional: Reference videos for motion guidance (up to 3)",
          reference_audio_urls:
            "Optional: Reference audio for sound-guided generation (up to 3)",
          aspect_ratio: "Optional: Video aspect ratio (default: 16:9)",
          resolution:
            'Optional: Video resolution: "480p" or "720p" (default: 720p)',
          duration: "Optional: Video duration in seconds 4-15 (default: 5)",
          generate_audio: "Optional: Generate native audio (default: true)",
          web_search:
            "Optional: Enable web search for prompt enhancement (default: false)",
          nsfw_checker:
            "Optional: Enable NSFW content filtering (default: false)",
          callBackUrl: "Optional: URL for task completion notifications",
        });
      }

      return ctx.formatError("bytedance_seedance_video", error, {
        prompt: "Required: Text prompt for video generation",
        mode: 'Optional: "standard" or "fast"',
        aspect_ratio: "Optional: Video aspect ratio",
        resolution: 'Optional: "480p" or "720p"',
        duration: "Optional: Duration in seconds 4-15",
        callBackUrl: "Optional: URL for task completion notifications",
      });
    }
  },
};

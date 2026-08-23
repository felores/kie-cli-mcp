import { z } from "zod";
import { ByteDanceSeedanceVideoSchema } from "../types.js";
import type { ToolContext, ToolDef, ToolResult } from "./types.js";

export const bytedanceSeedanceVideoTool: ToolDef<
  typeof ByteDanceSeedanceVideoSchema
> = {
  name: "bytedance_seedance_video",
  description:
    "Generate videos with ByteDance Seedance 2.5 using text, experimental semantic task continuation, first/last frames, or multimodal image/video/audio references.",
  category: "video",
  schema: ByteDanceSeedanceVideoSchema,
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const request = ByteDanceSeedanceVideoSchema.parse(args);

      // Use intelligent callback URL fallback
      request.callBackUrl = ctx.getCallbackUrl(request.callBackUrl);

      const response = await ctx.client.generateByteDanceSeedanceVideo(request);

      if (response.code === 200 && response.data?.taskId) {
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
                  message:
                    "ByteDance Seedance 2.5 video generation task created successfully",
                  parameters: {
                    prompt:
                      request.prompt.substring(0, 100) +
                      (request.prompt.length > 100 ? "..." : ""),
                    ...(request.extension_task_id && {
                      extension_task_id: request.extension_task_id,
                    }),
                    ...(request.first_frame_url && {
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
                    ...(request.return_last_frame !== undefined && {
                      return_last_frame: request.return_last_frame,
                    }),
                    ...(request.generate_audio !== undefined && {
                      generate_audio: request.generate_audio,
                    }),
                    ...(request.resolution && {
                      resolution: request.resolution,
                    }),
                    ...(request.aspect_ratio && {
                      aspect_ratio: request.aspect_ratio,
                    }),
                    ...(request.duration !== undefined && {
                      duration: request.duration,
                    }),
                  },
                  next_steps: [
                    "Use get_task_status to check generation progress",
                    "Task completion will be sent to the provided callback URL",
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
          prompt: "Required: text prompt for Seedance 2.5 video generation",
          extension_task_id:
            "Optional, experimental: previous Seedance task ID for semantic continuation; use first_frame_url for visual continuity",
          first_frame_url: "Optional: URL of image to use as the first frame",
          last_frame_url:
            "Optional: URL of image to use as the last frame; requires first_frame_url",
          reference_image_urls:
            "Optional: reference images for multimodal reference-to-video",
          reference_video_urls:
            "Optional: reference videos for multimodal reference-to-video",
          reference_audio_urls:
            "Optional: reference audio for multimodal reference-to-video",
          return_last_frame: "Optional: return the generated last frame",
          aspect_ratio: "Optional: video aspect ratio",
          resolution:
            "Optional: video resolution (the official example uses 720p)",
          duration: "Optional: integer video duration in seconds",
          generate_audio: "Optional: generate audio for the video",
          callBackUrl: "Optional: URL for task completion notifications",
        });
      }

      return ctx.formatError("bytedance_seedance_video", error, {
        prompt: "Required: text prompt for Seedance 2.5 video generation",
        extension_task_id:
          "Optional, experimental: previous Seedance task ID for semantic continuation; use first_frame_url for visual continuity",
        first_frame_url: "Optional: first-frame image URL",
        last_frame_url:
          "Optional: last-frame image URL (requires first_frame_url)",
        reference_image_urls: "Optional: multimodal reference image URLs",
        reference_video_urls: "Optional: multimodal reference video URLs",
        reference_audio_urls: "Optional: multimodal reference audio URLs",
        return_last_frame: "Optional: return the generated last frame",
        aspect_ratio: "Optional: Video aspect ratio",
        resolution: "Optional: video resolution",
        duration: "Optional: integer duration in seconds",
        generate_audio: "Optional: generate audio for the video",
        callBackUrl: "Optional: URL for task completion notifications",
      });
    }
  },
};

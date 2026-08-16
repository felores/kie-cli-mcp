import { z } from "zod";
import { HailuoVideoSchema } from "../types.js";
import type { ToolDef, ToolContext, ToolResult } from "./types.js";

export const hailuoVideoTool: ToolDef<typeof HailuoVideoSchema> = {
  name: "hailuo_video",
  description:
    "Generate videos using MiniMax H3 (Hailuo 03) with text-to-video, image-to-video, or multimodal reference-to-video inputs.",
  category: "video",
  schema: HailuoVideoSchema,
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const request = HailuoVideoSchema.parse(args);

      request.callBackUrl = ctx.getCallbackUrl(request.callBackUrl);

      const response = await ctx.client.generateHailuoVideo(request);

      let mode: "text-to-video" | "image-to-video" | "reference-to-video";
      if (request.imageUrl) {
        mode = "image-to-video";
      } else if (
        request.referenceImageUrls?.length ||
        request.referenceVideoUrls?.length ||
        request.referenceAudioUrls?.length
      ) {
        mode = "reference-to-video";
      } else {
        mode = "text-to-video";
      }

      if (response.code === 200 && response.data?.taskId) {
        await ctx.db.createTask({
          task_id: response.data.taskId,
          api_type: "hailuo",
          status: "pending",
        });
      } else {
        throw new Error(response.msg || "Failed to create MiniMax H3 video task");
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                task_id: response.data?.taskId,
                mode,
                message: `MiniMax H3 ${mode} task created successfully`,
                parameters: {
                  prompt: request.prompt,
                  imageUrl: request.imageUrl,
                  endImageUrl: request.endImageUrl,
                  referenceImageUrls: request.referenceImageUrls,
                  referenceVideoUrls: request.referenceVideoUrls,
                  referenceAudioUrls: request.referenceAudioUrls,
                  duration: request.duration,
                  aspectRatio: request.aspectRatio,
                  callBackUrl: request.callBackUrl,
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
    } catch (error) {
      if (error instanceof z.ZodError) {
        return ctx.formatError("hailuo_video", error, {
          prompt: "Required: video description",
          duration: "Required: integer video duration from 4 to 15 seconds",
          aspectRatio:
            "Text-to-video: required output ratio (21:9, 16:9, 4:3, 1:1, 3:4, or 9:16). Reference-to-video also accepts adaptive.",
          imageUrl: "Image-to-video: first-frame image URL",
          endImageUrl:
            "Image-to-video: optional last-frame image URL (requires imageUrl)",
          referenceImageUrls:
            "Reference-to-video: up to 9 reference image URLs",
          referenceVideoUrls:
            "Reference-to-video: up to 3 reference video URLs",
          referenceAudioUrls:
            "Reference-to-video: up to 3 reference audio URLs",
          callBackUrl:
            "Optional: callback URL for notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
        });
      }

      return ctx.formatError("hailuo_video", error, {
        prompt: "Required: text description for MiniMax H3 video generation",
        duration: "Required: integer video duration from 4 to 15 seconds",
        imageUrl: "Image-to-video: first-frame image URL",
        referenceImageUrls: "Reference-to-video: reference image URLs",
        referenceVideoUrls: "Reference-to-video: reference video URLs",
        referenceAudioUrls: "Reference-to-video: reference audio URLs",
        callBackUrl: "Optional: URL for task completion notifications",
      });
    }
  },
};

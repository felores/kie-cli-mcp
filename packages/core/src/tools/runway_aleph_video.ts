import { z } from "zod";
import { RunwayAlephVideoSchema } from "../types.js";
import type { ToolDef, ToolContext, ToolResult } from "./types.js";

export const runwayAlephVideoTool: ToolDef<typeof RunwayAlephVideoSchema> = {
  name: "runway_aleph_video",
  description: "Transform videos using Runway Aleph video-to-video generation with AI-powered editing",
  category: "video",
  schema: RunwayAlephVideoSchema,
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const request = RunwayAlephVideoSchema.parse(args);

      // Use intelligent callback URL fallback
      request.callBackUrl = ctx.getCallbackUrl(request.callBackUrl);

      const response = await ctx.client.generateRunwayAlephVideo(request);

      if (response.code === 200 && response.data?.taskId) {
        // Store task in database
        await ctx.db.createTask({
          task_id: response.data.taskId,
          api_type: "runway-aleph-video",
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
                    "Runway Aleph video-to-video transformation task created successfully",
                  parameters: {
                    prompt:
                      request.prompt.substring(0, 100) +
                      (request.prompt.length > 100 ? "..." : ""),
                    video_url: request.videoUrl,
                    aspect_ratio: request.aspectRatio || "16:9",
                    water_mark: request.waterMark || "",
                    upload_cn: request.uploadCn || false,
                    ...(request.seed !== undefined && { seed: request.seed }),
                    ...(request.referenceImage && {
                      reference_image: request.referenceImage,
                    }),
                  },
                  next_steps: [
                    "Use get_task_status to check transformation progress",
                    "Task completion will be sent to the provided callback URL",
                    "Video-to-video transformation typically takes 3-8 minutes depending on complexity and length",
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
            "Failed to create Runway Aleph video transformation task",
        );
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return ctx.formatError("runway_aleph_video", error, {
          prompt:
            "Required: Text prompt describing desired video transformation (max 1000 characters)",
          videoUrl: "Required: URL of the input video to transform",
          waterMark:
            "Optional: Watermark text to add to the video (max 100 characters)",
          uploadCn:
            "Optional: Whether to upload to China servers (default: false)",
          aspectRatio: "Optional: Output video aspect ratio (default: 16:9)",
          seed: "Optional: Random seed for reproducible results (1-999999)",
          referenceImage: "Optional: URL of reference image for style guidance",
          callBackUrl:
            "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
        });
      }

      return ctx.formatError("runway_aleph_video", error, {
        prompt: "Required: Text prompt for video transformation",
        videoUrl: "Required: URL of input video",
        aspectRatio: "Optional: Output video aspect ratio",
        callBackUrl: "Optional: URL for task completion notifications",
      });
    }
  },
};

import { z } from "zod";
import { HailuoVideoSchema } from "../types.js";
import type { ToolDef, ToolContext, ToolResult } from "./types.js";

export const hailuoVideoTool: ToolDef<typeof HailuoVideoSchema> = {
  name: "hailuo_video",
  description: "Generate videos using Hailuo AI models (unified tool for text-to-video and image-to-video with standard/pro quality). Supports v02 (original) and v2.3 (enhanced motion/expressions, 1080P)",
  category: "video",
  schema: HailuoVideoSchema,
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const request = HailuoVideoSchema.parse(args);

      request.callBackUrl = ctx.getCallbackUrl(request.callBackUrl);

      const response = await ctx.client.generateHailuoVideo(request);

      const version = request.version || "02";
      let modeDescription: string;
      if (request.imageUrl) {
        modeDescription = `v${version} image-to-video (${request.quality || "standard"} quality)`;
      } else {
        modeDescription = `v${version} text-to-video (${request.quality || "standard"} quality)`;
      }

      if (response.data?.taskId) {
        await ctx.db.createTask({
          task_id: response.data.taskId,
          api_type: "hailuo",
          status: "pending",
        });
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
                message: `Hailuo ${modeDescription} task created successfully`,
                parameters: {
                  version,
                  prompt: request.prompt,
                  imageUrl: request.imageUrl,
                  endImageUrl: request.endImageUrl,
                  quality: request.quality || "standard",
                  duration: request.duration || "6",
                  resolution: request.resolution || "768P",
                  promptOptimizer: request.promptOptimizer !== false,
                  callBackUrl: request.callBackUrl,
                },
                next_steps: [
                  "Use get_task_status to check generation progress",
                  "Task completion will be sent to the provided callback URL",
                  "Video generation typically takes 1-3 minutes for standard, 3-5 minutes for pro quality",
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
          prompt: "Required: video description (max 1500 chars)",
          imageUrl: "Optional: image URL for image-to-video mode",
          endImageUrl:
            "Optional: end frame image URL for image-to-video (requires imageUrl)",
          version:
            'Optional: model version "02" (default) or "2.3" (enhanced motion)',
          quality: 'Optional: quality level "standard" (default) or "pro"',
          duration:
            'Optional: video duration "6" (default) or "10" (10s not supported with 1080P in v2.3)',
          resolution:
            'Optional: resolution "512P"/"768P" for v02, "768P"/"1080P" for v2.3',
          promptOptimizer:
            "Optional: enable prompt optimization (default: true)",
          callBackUrl:
            "Optional: callback URL for notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
        });
      }

      return ctx.formatError("hailuo_video", error, {
        prompt: "Required: text description for video generation",
        imageUrl: "Optional: image URL for image-to-video mode",
        endImageUrl: "Optional: end frame image for image-to-video",
        quality: "Optional: quality level (standard or pro)",
        duration:
          "Optional: video duration in seconds (6 or 10 for standard only)",
        resolution:
          "Optional: video resolution (512P or 768P for standard only)",
        promptOptimizer: "Optional: enable prompt optimization",
        callBackUrl: "Optional: URL for task completion notifications",
      });
    }
  },
};

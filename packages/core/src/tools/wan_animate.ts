import { z } from "zod";
import { WanAnimateSchema } from "../types.js";
import type { ToolDef, ToolContext, ToolResult } from "./types.js";

export const wanAnimateTool: ToolDef<typeof WanAnimateSchema> = {
  name: "wan_animate",
  description:
    "Animate static images or replace characters in videos using Alibaba's Wan 2.2 Animate models with motion transfer and seamless environmental integration",
  category: "video",
  schema: WanAnimateSchema,
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const request = WanAnimateSchema.parse(args);

      request.callBackUrl = ctx.getCallbackUrl(request.callBackUrl);

      const response = await ctx.client.generateWanAnimate(request);

      const modeDescription =
        request.mode === "replace" ? "character replacement" : "animation";

      if (response.code === 200 && response.data?.taskId) {
        await ctx.db.createTask({
          task_id: response.data.taskId,
          api_type: "wan-animate",
          status: "pending",
        });
      } else {
        throw new Error(response.msg || "Failed to create Wan Animate task");
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
                message: `Wan 2.2 Animate task created successfully (${modeDescription} mode)`,
                parameters: {
                  video_url: request.video_url,
                  image_url: request.image_url,
                  mode: request.mode || "animate",
                  resolution: request.resolution || "480p",
                  callBackUrl: request.callBackUrl,
                },
                next_steps: [
                  "Use get_task_status to check generation progress",
                  "Task completion will be sent to the provided callback URL",
                  "Video generation time depends on input video length",
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
        return ctx.formatError("wan_animate", error, {
          video_url:
            "Required: URL of reference video (MP4, max 10MB, max 30 seconds)",
          image_url:
            "Required: URL of character image (JPEG/PNG/WEBP, max 10MB)",
          mode: 'Optional: "animate" (default) or "replace"',
          resolution:
            'Optional: "480p" (default, ~$0.03/sec), "580p" (~$0.0475/sec), or "720p" (~$0.0625/sec)',
          callBackUrl:
            "Optional: callback URL for notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
        });
      }

      return ctx.formatError("wan_animate", error, {
        video_url: "Required: URL of reference video",
        image_url: "Required: URL of character image",
        mode: "Optional: animate or replace",
        resolution: "Optional: 480p, 580p, or 720p",
        callBackUrl: "Optional: URL for task completion notifications",
      });
    }
  },
};

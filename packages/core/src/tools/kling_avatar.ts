import { z } from "zod";
import { KlingAvatarSchema } from "../types.js";
import type { ToolDef, ToolContext, ToolResult } from "./types.js";

export const klingAvatarTool: ToolDef<typeof KlingAvatarSchema> = {
  name: "kling_avatar",
  description: "Generate lifelike talking avatar videos using Kuaishou Kling AI. Transforms portrait photo + audio into realistic avatar with accurate lip-sync, emotions, and identity preservation. Pricing: ~$0.04/s (720P standard), ~$0.08/s (1080P pro), max 15s",
  category: "video",
  schema: KlingAvatarSchema,
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const request = KlingAvatarSchema.parse(args);

      // Use intelligent callback URL fallback
      request.callBackUrl = ctx.getCallbackUrl(request.callBackUrl);

      const response = await ctx.client.generateKlingAvatar(request);

      if (response.code === 200 && response.data?.taskId) {
        // Store task in database
        await ctx.db.createTask({
          task_id: response.data.taskId,
          api_type: "kling-avatar",
          status: "pending",
        });

        const quality = request.quality || "standard";
        const resolution = quality === "pro" ? "1080P" : "720P";
        const pricing = quality === "pro" ? "~$0.08/s" : "~$0.04/s";

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  task_id: response.data.taskId,
                  message: "Kling Avatar video task created successfully",
                  parameters: {
                    quality,
                    resolution,
                    prompt:
                      request.prompt.substring(0, 100) +
                      (request.prompt.length > 100 ? "..." : ""),
                  },
                  pricing: `${pricing} (max 15 seconds)`,
                  next_steps: [
                    `Use get_task_status with task_id: ${response.data.taskId} to check progress`,
                    'Avatar video will be available when status is "completed"',
                  ],
                },
                null,
                2,
              ),
            },
          ],
        };
      } else {
        throw new Error(response.msg || "Failed to create Kling Avatar task");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return ctx.formatError("kling_avatar", error, {
          image_url: "Required: URL of portrait image for avatar",
          audio_url: "Required: URL of audio file for avatar to speak",
          prompt: "Required: Text prompt to guide video generation",
          quality: "Optional: standard (720P, default) or pro (1080P)",
          callBackUrl: "Optional: URL for task completion notifications",
        });
      }

      return ctx.formatError("kling_avatar", error, {
        image_url: "Required: URL of portrait image for avatar",
        audio_url: "Required: URL of audio file for avatar to speak",
        prompt: "Required: Text prompt to guide video generation",
      });
    }
  },
};

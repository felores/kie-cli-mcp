import { z } from "zod";
import { InfiniTalkSchema } from "../types.js";
import type { ToolDef, ToolContext, ToolResult } from "./types.js";

export const infinitalkLipSyncTool: ToolDef<typeof InfiniTalkSchema> = {
  name: "infinitalk_lip_sync",
  description: "Generate AI lip-sync talking videos using MeiGen-AI InfiniTalk. Transforms portrait image + audio into natural talking avatar with synchronized lips, facial expressions, and head movements. Pricing: ~$0.015/s (480p), ~$0.06/s (720p), max 15s",
  category: "video",
  schema: InfiniTalkSchema,
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const request = InfiniTalkSchema.parse(args);

      // Use intelligent callback URL fallback
      request.callBackUrl = ctx.getCallbackUrl(request.callBackUrl);

      const response = await ctx.client.generateInfiniTalk(request);

      if (response.code === 200 && response.data?.taskId) {
        // Store task in database
        await ctx.db.createTask({
          task_id: response.data.taskId,
          api_type: "infinitalk",
          status: "pending",
        });

        const resolution = request.resolution || "480p";
        const pricing = resolution === "720p" ? "~$0.06/s" : "~$0.015/s";

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  task_id: response.data.taskId,
                  message:
                    "InfiniTalk lip-sync video task created successfully",
                  parameters: {
                    prompt:
                      request.prompt.substring(0, 100) +
                      (request.prompt.length > 100 ? "..." : ""),
                    resolution,
                    seed: request.seed,
                  },
                  pricing: `${pricing} (max 15 seconds)`,
                  next_steps: [
                    `Use get_task_status with task_id: ${response.data.taskId} to check progress`,
                    'Lip-synced video will be available when status is "completed"',
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
          response.msg || "Failed to create InfiniTalk lip-sync task",
        );
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return ctx.formatError("infinitalk_lip_sync", error, {
          image_url: "Required: URL of portrait image to animate",
          audio_url: "Required: URL of audio file for lip sync",
          prompt: "Required: Text prompt to guide video generation",
          resolution:
            "Optional: 480p (default, cheaper) or 720p (higher quality)",
          seed: "Optional: Random seed for reproducibility (10000-1000000)",
          callBackUrl: "Optional: URL for task completion notifications",
        });
      }

      return ctx.formatError("infinitalk_lip_sync", error, {
        image_url: "Required: URL of portrait image to animate",
        audio_url: "Required: URL of audio file for lip sync",
        prompt: "Required: Text prompt to guide video generation",
      });
    }
  },
};

import { z } from "zod";
import { RecraftRemoveBackgroundSchema } from "../types.js";
import type { ToolDef, ToolContext, ToolResult } from "./types.js";

export const recraftRemoveBackgroundTool: ToolDef<typeof RecraftRemoveBackgroundSchema> = {
  name: "recraft_remove_background",
  description: "Remove backgrounds from images using Recraft AI background removal model",
  category: "image",
  schema: RecraftRemoveBackgroundSchema,
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const request = RecraftRemoveBackgroundSchema.parse(args);

      // Use intelligent callback URL fallback
      request.callBackUrl = ctx.getCallbackUrl(request.callBackUrl);

      const response =
        await ctx.client.generateRecraftRemoveBackground(request);

      if (response.code === 200 && response.data?.taskId) {
        // Store task in database
        await ctx.db.createTask({
          task_id: response.data.taskId,
          api_type: "recraft-remove-background",
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
                    "Recraft Remove Background task created successfully",
                  parameters: {
                    image: request.image,
                    callBackUrl: request.callBackUrl,
                  },
                  next_steps: [
                    "Use get_task_status to check generation progress",
                    "Task completion will be sent to the provided callback URL",
                    "Background removal typically takes 30-60 seconds depending on image complexity",
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
          response.msg || "Failed to create Recraft Remove Background task",
        );
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return ctx.formatError("recraft_remove_background", error, {
          image:
            "Required: URL of image to remove background from (PNG, JPG, WEBP, max 5MB, 16MP, 4096px max, 256px min)",
          callBackUrl:
            "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
        });
      }

      return ctx.formatError("recraft_remove_background", error, {
        image: "Required: URL of image to remove background from",
        callBackUrl: "Optional: URL for task completion notifications",
      });
    }
  },
};

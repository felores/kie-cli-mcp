import { z } from "zod";
import { SunoGenerateSchema } from "../types.js";
import type { ToolDef, ToolContext, ToolResult } from "./types.js";

export const sunoGenerateMusicTool: ToolDef<typeof SunoGenerateSchema> = {
  name: "suno_generate_music",
  description: "Generate music with AI using Suno models (V3_5, V4, V4_5, V4_5PLUS, V5)",
  category: "audio",
  schema: SunoGenerateSchema,
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const request = SunoGenerateSchema.parse(args);

      // Use intelligent callback URL fallback
      request.callBackUrl = ctx.getCallbackUrl(request.callBackUrl);

      const response = await ctx.client.generateSunoMusic(request);

      if (response.code === 200 && response.data?.taskId) {
        // Store task in database
        await ctx.db.createTask({
          task_id: response.data.taskId,
          api_type: "suno",
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
                  message: "Music generation task created successfully",
                  parameters: {
                    model: request.model || "V5",
                    customMode: request.customMode,
                    instrumental: request.instrumental,
                    callBackUrl: request.callBackUrl,
                  },
                  next_steps: [
                    "Use get_task_status to check generation progress",
                    "Task completion will be sent to the provided callback URL",
                    "Generation typically takes 1-3 minutes depending on model and length",
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
          response.msg || "Failed to create music generation task",
        );
      }
    } catch (error) {
      return ctx.formatError("suno_generate_music", error, {
        prompt: "Required: Description of desired audio content",
        customMode: "Required: Enable advanced customization (true/false)",
        instrumental: "Required: Generate instrumental music (true/false)",
        model: "Required: AI model version (V3_5, V4, V4_5, V4_5PLUS, V5)",
        callBackUrl:
          "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
        style: "Optional: Music style/genre (required in custom mode)",
        title: "Optional: Track title (required in custom mode, max 80 chars)",
        negativeTags: "Optional: Styles to exclude (max 200 chars)",
        vocalGender:
          "Optional: Vocal gender preference (m/f, custom mode only)",
        styleWeight:
          "Optional: Style adherence strength (0-1, 2 decimal places)",
        weirdnessConstraint:
          "Optional: Creative deviation control (0-1, 2 decimal places)",
        audioWeight: "Optional: Audio feature balance (0-1, 2 decimal places)",
      });
    }
  },
};

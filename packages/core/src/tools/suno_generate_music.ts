import { SunoGenerateSchema } from "../types.js";
import type { ToolContext, ToolDef, ToolResult } from "./types.js";

export const sunoGenerateMusicTool: ToolDef<typeof SunoGenerateSchema> = {
  name: "suno_generate_music",
  description:
    "Generate music using Suno V6, V6 Mini, or V6 Wild with lyrics, style, personas, and non-custom media references. Older versions are removed.",
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
          api_type: "suno-v6",
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
                    model: request.model || "V6",
                    customMode: request.customMode,
                    instrumental: request.instrumental,
                    callBackUrl: request.callBackUrl,
                  },
                  next_steps: [
                    "Use get_task_status to check generation progress",
                    "Use wait_for_task to wait for all generated audio results",
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
        prompt: "Optional: Audio description or custom lyrics fallback",
        lyrics: "Optional: Lyrics up to 5000 characters",
        customMode: "Required: Enable advanced customization (true/false)",
        instrumental: "Required: Generate instrumental music (true/false)",
        model: "Optional: V6 (default), V6_MINI, V6_WILD",
        duration: "Optional: 10-360 seconds, custom mode only",
        callBackUrl:
          "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
        style: "Optional: Music style/genre, up to 1000 characters",
        title: "Optional: Track title (required in custom mode, max 80 chars)",
        negativeTags: "Optional: Styles to exclude",
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

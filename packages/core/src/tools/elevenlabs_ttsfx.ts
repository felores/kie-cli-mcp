import { z } from "zod";
import { ElevenLabsSoundEffectsSchema } from "../types.js";
import type { ToolDef, ToolContext, ToolResult } from "./types.js";

export const elevenlabsTtsfxTool: ToolDef<typeof ElevenLabsSoundEffectsSchema> = {
  name: "elevenlabs_ttsfx",
  description: "Generate sound effects from text descriptions using ElevenLabs Sound Effects v2 model",
  category: "audio",
  schema: ElevenLabsSoundEffectsSchema,
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const request = ElevenLabsSoundEffectsSchema.parse(args);

      // Use intelligent callback URL fallback
      request.callBackUrl = ctx.getCallbackUrl(request.callBackUrl);

      const response =
        await ctx.client.generateElevenLabsSoundEffects(request);

      if (response.code === 200 && response.data?.taskId) {
        // Store task in database
        await ctx.db.createTask({
          task_id: response.data.taskId,
          api_type: "elevenlabs-sound-effects",
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
                    "ElevenLabs Sound Effects generation task created successfully",
                  parameters: {
                    text:
                      request.text.substring(0, 100) +
                      (request.text.length > 100 ? "..." : ""),
                    duration_seconds:
                      request.duration_seconds || "Auto-determined",
                    prompt_influence: request.prompt_influence || 0.3,
                    output_format: request.output_format || "mp3_44100_192",
                    loop: request.loop || false,
                  },
                  next_steps: [
                    "Use get_task_status to check generation progress",
                    "Task completion will be sent to the provided callback URL",
                    "Sound effects generation typically takes 30-90 seconds depending on complexity",
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
          response.msg || "Failed to create Sound Effects generation task",
        );
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return ctx.formatError("elevenlabs_ttsfx", error, {
          text: "Required: The text describing the sound effect to generate (max 5000 characters)",
          loop: "Optional: Whether to create a looping sound effect (default: false)",
          duration_seconds: "Optional: Duration in seconds (0.5-22, step 0.1)",
          prompt_influence:
            "Optional: How closely to follow the prompt (0-1, step 0.01, default: 0.3)",
          output_format:
            "Optional: Audio output format (default: mp3_44100_128)",
          callBackUrl:
            "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
        });
      }

      return ctx.formatError("elevenlabs_ttsfx", error, {
        text: "Required: The text describing the sound effect to generate (max 5000 characters)",
        duration_seconds: "Optional: Duration in seconds (0.5-22)",
        output_format: "Optional: Audio output format",
        callBackUrl: "Optional: URL for task completion notifications",
      });
    }
  },
};

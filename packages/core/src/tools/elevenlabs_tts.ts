import { z } from "zod";
import { ElevenLabsTTSSchema } from "../types.js";
import type { ToolDef, ToolContext, ToolResult } from "./types.js";

export const elevenlabsTtsTool: ToolDef<typeof ElevenLabsTTSSchema> = {
  name: "elevenlabs_tts",
  description: "Generate speech from text using ElevenLabs TTS models (Turbo 2.5 by default, with optional Multilingual v2 support)",
  category: "audio",
  schema: ElevenLabsTTSSchema,
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const request = ElevenLabsTTSSchema.parse(args);

      // Use intelligent callback URL fallback
      request.callBackUrl = ctx.getCallbackUrl(request.callBackUrl);

      const response = await ctx.client.generateElevenLabsTTS(request);

      if (response.code === 200 && response.data?.taskId) {
        // Store task in database
        await ctx.db.createTask({
          task_id: response.data.taskId,
          api_type: "elevenlabs-tts",
          status: "pending",
        });

        const model =
          request.model === "multilingual" ? "Multilingual v2" : "Turbo 2.5";

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  task_id: response.data.taskId,
                  message: `ElevenLabs TTS (${model}) generation task created successfully`,
                  parameters: {
                    model: model,
                    text:
                      request.text.substring(0, 100) +
                      (request.text.length > 100 ? "..." : ""),
                    voice: request.voice || "Rachel",
                    speed: request.speed || 1,
                    stability: request.stability || 0.5,
                    similarity_boost: request.similarity_boost || 0.75,
                    ...(request.model === "multilingual" && {
                      previous_text: request.previous_text || "None",
                      next_text: request.next_text || "None",
                    }),
                    ...(request.model === "turbo" && {
                      language_code: request.language_code || "None",
                    }),
                  },
                  next_steps: [
                    "Use get_task_status to check generation progress",
                    "Task completion will be sent to the provided callback URL",
                    request.model === "turbo"
                      ? "Turbo 2.5 generation is faster and supports language enforcement (15-60 seconds)"
                      : "Multilingual v2 generation supports context and continuity (30-120 seconds)",
                  ],
                },
                null,
                2,
              ),
            },
          ],
        };
      } else {
        throw new Error(response.msg || "Failed to create TTS generation task");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return ctx.formatError("elevenlabs_tts", error, {
          text: "Required: The text to convert to speech (max 5000 characters)",
          model:
            "Optional: TTS model - turbo (faster, default) or multilingual (supports context)",
          voice:
            "Optional: Voice to use (default: Rachel). Available: Rachel, Aria, Roger, Sarah, Laura, Charlie, George, Callum, River, Liam, Charlotte, Alice, Matilda, Will, Jessica, Eric, Chris, Brian, Daniel, Lily, Bill",
          stability: "Optional: Voice stability (0-1, default: 0.5)",
          similarity_boost: "Optional: Similarity boost (0-1, default: 0.75)",
          style: "Optional: Style exaggeration (0-1, default: 0)",
          speed: "Optional: Speech speed (0.7-1.2, default: 1.0)",
          timestamps: "Optional: Return word timestamps (default: false)",
          previous_text:
            "Optional: Previous text for continuity (multilingual model only, max 5000 chars)",
          next_text:
            "Optional: Next text for continuity (multilingual model only, max 5000 chars)",
          language_code:
            "Optional: ISO 639-1 language code for enforcement (turbo model only)",
          callBackUrl:
            "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
        });
      }

      return ctx.formatError("elevenlabs_tts", error, {
        text: "Required: The text to convert to speech (max 5000 characters)",
        model: "Optional: TTS model - turbo (default) or multilingual",
        voice: "Optional: Voice to use (default: Rachel)",
        callBackUrl: "Optional: URL for task completion notifications",
      });
    }
  },
};

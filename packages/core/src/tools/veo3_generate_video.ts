import { z } from "zod";
import { Veo3GenerateSchema } from "../types.js";
import type { ToolDef, ToolContext, ToolResult } from "./types.js";

export const veo3GenerateVideoTool: ToolDef<typeof Veo3GenerateSchema> = {
  name: "veo3_generate_video",
  description: "Generate professional-quality videos using Google's Veo3 API",
  category: "video",
  schema: Veo3GenerateSchema,
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const request = Veo3GenerateSchema.parse(args);

      // Use intelligent callback URL resolution
      request.callBackUrl = ctx.getCallbackUrl(request.callBackUrl);

      const response = await ctx.client.generateVeo3Video(request);

      if (response.data?.taskId) {
        await ctx.db.createTask({
          task_id: response.data.taskId,
          api_type: "veo3",
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
                message: "Veo3 video generation task created successfully",
                note: "Use get_task_status to check progress",
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      return ctx.formatError("veo3_generate_video", error, {
        prompt: "Required: video description (max 2000 chars)",
        imageUrls:
          "Optional: 1-2 image URLs for image-to-video (1 image = unfold around it, 2 images = start to end frame transition)",
        model: 'Optional: "veo3" (quality) or "veo3_fast" (cost-efficient)',
        watermark: "Optional: watermark text (max 100 chars)",
        aspectRatio: 'Optional: "16:9", "9:16", or "Auto"',
        seeds: "Optional: random seed (10000-99999)",
        callBackUrl: "Optional: callback URL for notifications",
        enableFallback: "Optional: enable fallback for content policy failures",
        enableTranslation: "Optional: auto-translate prompts to English",
      });
    }
  },
};

import { z } from "zod";
import { Flux2ImageSchema } from "../types.js";
import type { ToolDef, ToolContext, ToolResult } from "./types.js";

export const flux2ImageTool: ToolDef<typeof Flux2ImageSchema> = {
  name: "flux2_image",
  description: "Generate and edit images using Black Forest Labs' Flux 2 models (Pro/Flex) with multi-reference consistency, photoreal detail, and accurate text rendering",
  category: "image",
  schema: Flux2ImageSchema,
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const request = Flux2ImageSchema.parse(args);

      request.callBackUrl = ctx.getCallbackUrl(request.callBackUrl);

      const response = await ctx.client.generateFlux2Image(request);

      const hasInputUrls =
        !!request.input_urls && request.input_urls.length > 0;
      const modelType = request.model_type || "pro";
      const modeDescription = hasInputUrls
        ? `image-to-image (${modelType})`
        : `text-to-image (${modelType})`;

      if (response.data?.taskId) {
        await ctx.db.createTask({
          task_id: response.data.taskId,
          api_type: "flux2-image",
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
                message: `Flux 2 image generation task created successfully (${modeDescription})`,
                parameters: {
                  prompt: request.prompt,
                  input_urls: request.input_urls,
                  aspect_ratio: request.aspect_ratio || "1:1",
                  resolution: request.resolution || "1K",
                  model_type: modelType,
                  callBackUrl: request.callBackUrl,
                },
                next_steps: [
                  "Use get_task_status to check generation progress",
                  "Task completion will be sent to the provided callback URL",
                  "Image generation typically takes 10-30 seconds",
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
        return ctx.formatError("flux2_image", error, {
          prompt:
            "Required: text description of desired image (3-5000 characters)",
          input_urls:
            "Optional: array of reference image URLs for image-to-image mode (1-8 URLs)",
          aspect_ratio:
            'Optional: aspect ratio (1:1, 4:3, 3:4, 16:9, 9:16, 3:2, 2:3, auto). Default: 1:1. "auto" only valid with input_urls.',
          resolution:
            "Optional: output resolution (1K or 2K). Default: 1K. Pro: 1K~$0.025, 2K~$0.035. Flex: 1K~$0.07, 2K~$0.12.",
          model_type:
            'Optional: model variant ("pro" for fast results, "flex" for more control). Default: pro.',
          callBackUrl:
            "Optional: callback URL for notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
        });
      }

      return ctx.formatError("flux2_image", error, {
        prompt: "Required: text description of desired image",
        input_urls:
          "Optional: reference images for image-to-image mode (1-8 URLs)",
        aspect_ratio: "Optional: aspect ratio (default: 1:1)",
        resolution: "Optional: output resolution (1K or 2K)",
        model_type: "Optional: pro or flex (default: pro)",
        callBackUrl: "Optional: URL for task completion notifications",
      });
    }
  },
};

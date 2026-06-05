import { z } from "zod";
import { FluxKontextImageSchema } from "../types.js";
import type { ToolDef, ToolContext, ToolResult } from "./types.js";

export const fluxKontextImageTool: ToolDef<typeof FluxKontextImageSchema> = {
  name: "flux_kontext_image",
  description: "Generate or edit images using Flux Kontext AI models (unified tool for text-to-image generation and image editing)",
  category: "image",
  schema: FluxKontextImageSchema,
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const request = FluxKontextImageSchema.parse(args);

      // Determine mode based on presence of inputImage
      const hasInputImage = !!request.inputImage;
      const modeDisplay = hasInputImage
        ? "Image Editing"
        : "Text-to-Image Generation";

      // Use intelligent callback URL fallback
      request.callBackUrl = ctx.getCallbackUrl(request.callBackUrl);

      const response = await ctx.client.generateFluxKontextImage(request);

      if (response.code === 200 && response.data?.taskId) {
        // Store task in database
        await ctx.db.createTask({
          task_id: response.data.taskId,
          api_type: "flux-kontext-image",
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
                  message: `Flux Kontext ${modeDisplay} task created successfully`,
                  parameters: {
                    mode: modeDisplay,
                    prompt:
                      request.prompt.substring(0, 100) +
                      (request.prompt.length > 100 ? "..." : ""),
                    aspect_ratio: request.aspectRatio || "16:9",
                    output_format: request.outputFormat || "jpeg",
                    model: request.model || "flux-kontext-pro",
                    enable_translation: request.enableTranslation !== false,
                    prompt_upsampling: request.promptUpsampling || false,
                    safety_tolerance: request.safetyTolerance || 2,
                    upload_cn: request.uploadCn || false,
                    ...(hasInputImage && {
                      input_image: request.inputImage,
                    }),
                    ...(request.watermark && {
                      watermark: request.watermark,
                    }),
                  },
                  next_steps: [
                    `Use get_task_status with task_id: ${response.data.taskId} to check progress`,
                    'Generated images will be available when status is "completed"',
                    hasInputImage
                      ? "Image editing typically takes 1-3 minutes depending on complexity"
                      : "Image generation typically takes 30-60 seconds depending on complexity",
                  ],
                  usage_examples: [
                    `get_task_status: {"task_id": "${response.data.taskId}"}`,
                    `list_tasks: {"limit": 10}`,
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
          response.msg || "Failed to create Flux Kontext image task",
        );
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return ctx.formatError("flux_kontext_image", error, {
          prompt:
            "Required: Text prompt describing the desired image or edit (max 5000 chars, English recommended)",
          inputImage:
            "Optional: Input image URL for editing mode (required for image editing)",
          aspectRatio:
            "Optional: Output aspect ratio (21:9, 16:9, 4:3, 1:1, 3:4, 9:16, default: 16:9)",
          outputFormat: "Optional: Output format (jpeg, png, default: jpeg)",
          model:
            "Optional: Model version (flux-kontext-pro, flux-kontext-max, default: flux-kontext-pro)",
          enableTranslation:
            "Optional: Auto-translate non-English prompts (default: true)",
          promptUpsampling:
            "Optional: Enable prompt enhancement (default: false)",
          safetyTolerance:
            "Optional: Content moderation level (0-6 for generation, 0-2 for editing, default: 2)",
          uploadCn:
            "Optional: Route uploads via China servers (default: false)",
          watermark: "Optional: Watermark identifier to add to generated image",
          callBackUrl: "Optional: Webhook URL for completion notifications",
        });
      }

      return ctx.formatError("flux_kontext_image", error, {
        prompt:
          "Required: Text prompt describing the desired image or edit (max 5000 chars, English recommended)",
        inputImage:
          "Optional: Input image URL for editing mode (required for image editing)",
        aspectRatio:
          "Optional: Output aspect ratio (21:9, 16:9, 4:3, 1:1, 3:4, 9:16, default: 16:9)",
        outputFormat: "Optional: Output format (jpeg, png, default: jpeg)",
        model:
          "Optional: Model version (flux-kontext-pro, flux-kontext-max, default: flux-kontext-pro)",
        enableTranslation:
          "Optional: Auto-translate non-English prompts (default: true)",
        promptUpsampling:
          "Optional: Enable prompt enhancement (default: false)",
        safetyTolerance:
          "Optional: Content moderation level (0-6 for generation, 0-2 for editing, default: 2)",
        uploadCn: "Optional: Route uploads via China servers (default: false)",
        watermark: "Optional: Watermark identifier to add to generated image",
        callBackUrl: "Optional: Webhook URL for completion notifications",
      });
    }
  },
};

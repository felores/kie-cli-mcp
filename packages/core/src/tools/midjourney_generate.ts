import { z } from "zod";
import { MidjourneyGenerateSchema } from "../types.js";
import type { ToolDef, ToolContext, ToolResult } from "./types.js";

export const midjourneyGenerateTool: ToolDef<typeof MidjourneyGenerateSchema> = {
  name: "midjourney_generate",
  description: "Generate images and videos using Midjourney AI models (unified tool for text-to-image, image-to-image, style reference, omni reference, and video generation)",
  category: "image",
  schema: MidjourneyGenerateSchema,
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const request = MidjourneyGenerateSchema.parse(args);

      // Use intelligent callback URL fallback
      request.callBackUrl = ctx.getCallbackUrl(request.callBackUrl);

      const response = await ctx.client.generateMidjourney(request);

      if (response.code === 200 && response.data?.taskId) {
        // Determine task type for user feedback
        const hasImage =
          request.fileUrl || (request.fileUrls && request.fileUrls.length > 0);
        const isVideoMode =
          request.motion ||
          request.videoBatchSize ||
          request.high_definition_video;
        const isOmniMode =
          request.ow || request.taskType === "mj_omni_reference";
        const isStyleMode = request.taskType === "mj_style_reference";

        let taskTypeDisplay = "Text-to-Image";
        if (isOmniMode) {
          taskTypeDisplay = "Omni Reference";
        } else if (isStyleMode) {
          taskTypeDisplay = "Style Reference";
        } else if (isVideoMode) {
          taskTypeDisplay = request.high_definition_video
            ? "Image-to-HD-Video"
            : "Image-to-Video";
        } else if (hasImage) {
          taskTypeDisplay = "Image-to-Image";
        }

        // Store task in database
        await ctx.db.createTask({
          task_id: response.data.taskId,
          api_type: "midjourney",
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
                  message: `Midjourney ${taskTypeDisplay} task created successfully`,
                  parameters: {
                    task_type: taskTypeDisplay,
                    prompt:
                      request.prompt.substring(0, 100) +
                      (request.prompt.length > 100 ? "..." : ""),
                    aspect_ratio: request.aspectRatio || "16:9",
                    version: request.version || "7",
                    speed: request.speed,
                    variety: request.variety,
                    stylization: request.stylization,
                    weirdness: request.weirdness,
                    enable_translation: request.enableTranslation || false,
                    waterMark: request.waterMark,
                    ...(hasImage && {
                      file_urls: request.fileUrls || [request.fileUrl],
                    }),
                    ...(isVideoMode && {
                      motion: request.motion || "high",
                      video_batch_size: request.videoBatchSize || "1",
                      high_definition_video:
                        request.high_definition_video || false,
                    }),
                    ...(isOmniMode && {
                      ow: request.ow,
                    }),
                  },
                  next_steps: [
                    `Use get_task_status with task_id: ${response.data.taskId} to check progress`,
                    'Generated content will be available when status is "completed"',
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
        throw new Error(response.msg || "Failed to create Midjourney task");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return ctx.formatError("midjourney_generate", error, {
          prompt:
            "Required: Text prompt describing the desired image (max 2000 chars)",
          taskType:
            "Optional: Task type (mj_txt2img, mj_img2img, mj_style_reference, mj_omni_reference, mj_video, mj_video_hd) - auto-detected if not provided",
          fileUrl:
            "Optional: Single image URL for image-to-image or video generation (legacy)",
          fileUrls:
            "Optional: Array of image URLs for image-to-image or video generation (recommended)",
          speed:
            "Optional: Generation speed (relaxed/fast/turbo) - not required for video/omni tasks",
          aspectRatio:
            "Optional: Output aspect ratio (1:2, 9:16, 2:3, 3:4, 5:6, 6:5, 4:3, 3:2, 1:1, 16:9, 2:1, default: 16:9)",
          version:
            "Optional: Midjourney model version (7, 6.1, 6, 5.2, 5.1, niji6, default: 7)",
          variety: "Optional: Diversity control (0-100, increment by 5)",
          stylization:
            "Optional: Artistic style intensity (0-1000, suggested multiple of 50)",
          weirdness:
            "Optional: Creativity level (0-3000, suggested multiple of 100)",
          ow: "Optional: Omni intensity for omni reference tasks (1-1000)",
          waterMark: "Optional: Watermark identifier (max 100 chars)",
          enableTranslation:
            "Optional: Auto-translate non-English prompts (default: false)",
          videoBatchSize:
            "Optional: Number of videos to generate (1/2/4, default: 1, video mode only)",
          motion:
            "Optional: Video motion level (high/low, default: high, required for video)",
          high_definition_video:
            "Optional: Use HD video generation (default: false, uses standard definition)",
          callBackUrl:
            "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
        });
      }

      return ctx.formatError("midjourney_generate", error, {
        prompt:
          "Required: Text prompt describing the desired image (max 2000 chars)",
        taskType:
          "Optional: Task type (mj_txt2img, mj_img2img, mj_style_reference, mj_omni_reference, mj_video, mj_video_hd) - auto-detected if not provided",
        fileUrl:
          "Optional: Single image URL for image-to-image or video generation (legacy)",
        fileUrls:
          "Optional: Array of image URLs for image-to-image or video generation (recommended)",
        speed:
          "Optional: Generation speed (relaxed/fast/turbo) - not required for video/omni tasks",
        aspectRatio:
          "Optional: Output aspect ratio (1:2, 9:16, 2:3, 3:4, 5:6, 6:5, 4:3, 3:2, 1:1, 16:9, 2:1, default: 16:9)",
        version:
          "Optional: Midjourney model version (7, 6.1, 6, 5.2, 5.1, niji6, default: 7)",
        variety: "Optional: Diversity control (0-100, increment by 5)",
        stylization:
          "Optional: Artistic style intensity (0-1000, suggested multiple of 50)",
        weirdness:
          "Optional: Creativity level (0-3000, suggested multiple of 100)",
        ow: "Optional: Omni intensity for omni reference tasks (1-1000)",
        waterMark: "Optional: Watermark identifier (max 100 chars)",
        enableTranslation:
          "Optional: Auto-translate non-English prompts (default: false)",
        videoBatchSize:
          "Optional: Number of videos to generate (1/2/4, default: 1, video mode only)",
        motion:
          "Optional: Video motion level (high/low, default: high, required for video)",
        high_definition_video:
          "Optional: Use HD video generation (default: false, uses standard definition)",
        callBackUrl:
          "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
      });
    }
  },
};

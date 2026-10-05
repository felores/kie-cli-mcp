import { z } from "zod";
import { ByteDanceSeedreamImageSchema } from "../types.js";
import type { ToolContext, ToolDef, ToolResult } from "./types.js";

export const bytedanceSeedreamImageTool: ToolDef<
  typeof ByteDanceSeedreamImageSchema
> = {
  name: "bytedance_seedream_image",
  description:
    "Generate, edit, or decompose images into layers using Seedream 5 Pro or Flash. image_urls selects editing; image_url selects layer decomposition. Older versions are removed.",
  category: "image",
  schema: ByteDanceSeedreamImageSchema,
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const request = ByteDanceSeedreamImageSchema.parse(args);

      // Use intelligent callback URL fallback
      request.callBackUrl = ctx.getCallbackUrl(request.callBackUrl);

      const response = await ctx.client.generateByteDanceSeedreamImage(request);

      if (response.code === 200 && response.data?.taskId) {
        // Determine mode for user feedback
        const isEdit = !!request.image_urls && request.image_urls.length > 0;
        const mode = request.image_url
          ? "Layer Decomposition"
          : isEdit
            ? "Image Editing"
            : "Text-to-Image";

        // Store task in database
        await ctx.db.createTask({
          task_id: response.data.taskId,
          api_type: "bytedance-seedream-image",
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
                  message: `Seedream ${request.version ?? "5-pro"} ${mode} task created successfully`,
                  parameters: {
                    mode: mode,
                    prompt: request.prompt?.substring(0, 100),
                    version: request.version ?? "5-pro",
                    aspect_ratio: request.image_url
                      ? undefined
                      : (request.aspect_ratio ?? "1:1"),
                    quality:
                      request.version !== "5-flash" && !request.image_url
                        ? (request.quality ?? "basic")
                        : undefined,
                    size: request.image_url
                      ? (request.size ?? "auto")
                      : request.version === "5-flash"
                        ? (request.size ?? "1K")
                        : undefined,
                    ...(isEdit && {
                      image_urls_count: request.image_urls?.length || 0,
                    }),
                  },
                  next_steps: [
                    `Use get_task_status with task_id: ${response.data.taskId} to check progress`,
                    'Generated images will be available when status is "completed"',
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
          response.msg || "Failed to create ByteDance Seedream image task",
        );
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return ctx.formatError("bytedance_seedream_image", error, {
          prompt:
            "Generation/edit prompt: 3-5000 characters; optional for layers",
          image_urls:
            "Optional: Array of image URLs for editing mode (1-10 images)",
          image_url: "Layer decomposition: single source image URL",
          version: "5-pro (default) or 5-flash",
          quality: "Pro generation/edit only: basic (1K) or high (2K)",
          size: "Flash: 1K/1.5K/2K; layers also accept auto",
          callBackUrl:
            "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
        });
      }

      return ctx.formatError("bytedance_seedream_image", error, {
        prompt:
          "Generation/edit prompt: 3-5000 characters; optional for layers",
        image_urls:
          "Optional: Array of image URLs for editing mode (1-10 images)",
        image_url: "Layer decomposition: single source image URL",
        callBackUrl:
          "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
      });
    }
  },
};

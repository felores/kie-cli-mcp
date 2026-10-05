import { HappyHorseVideoSchema } from "../types.js";
import type { ToolDef } from "./types.js";

export const happyhorseVideoTool: ToolDef<typeof HappyHorseVideoSchema> = {
  name: "happyhorse_video",
  description:
    "Generate HappyHorse 1.1 videos from text, one first-frame image, or up to 9 reference images. Clips are 3-15 seconds at 720p/1080p. HappyHorse 1.0 editing and unsupported fields are removed; poll for results.",
  category: "video",
  schema: HappyHorseVideoSchema,
  async run(args, ctx) {
    try {
      const request = HappyHorseVideoSchema.parse(args);
      const response = await ctx.client.generateHappyHorseVideo(request);
      if (response.code !== 200 || !response.data?.taskId)
        throw new Error(response.msg || "Failed to create HappyHorse 1.1 task");
      await ctx.db.createTask({
        task_id: response.data.taskId,
        api_type: "happyhorse-video",
        status: "pending",
      });
      const mode =
        request.mode ??
        (request.reference_image?.length
          ? "reference-to-video"
          : request.image_urls?.length
            ? "image-to-video"
            : "text-to-video");
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                task_id: response.data.taskId,
                message: `HappyHorse 1.1 ${mode} task created successfully`,
                parameters: {
                  mode,
                  resolution: request.resolution,
                  duration: request.duration,
                  ...(mode !== "image-to-video" && {
                    aspect_ratio: request.aspect_ratio ?? "16:9",
                  }),
                },
                next_steps: [
                  "Use get_task_status or wait_for_task with this task_id",
                ],
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      return ctx.formatError("happyhorse_video", error, {
        prompt:
          "Required for text/reference-to-video, optional for image-to-video",
        mode: "text-to-video, image-to-video, or reference-to-video",
        image_urls: "Image-to-video: exactly one image",
        reference_image: "Reference-to-video: 1-9 images",
        aspect_ratio: "Text/reference mode only",
      });
    }
  },
};

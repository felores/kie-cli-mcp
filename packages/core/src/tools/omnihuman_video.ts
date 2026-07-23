import { z } from "zod";
import { OmniHumanVideoSchema } from "../types.js";
import type { ToolDef, ToolContext, ToolResult } from "./types.js";

export const omniHumanVideoTool: ToolDef<typeof OmniHumanVideoSchema> = {
  name: "omnihuman_video",
  description:
    "Animate a portrait, pet, or character from an image and audio using ByteDance OmniHuman 1.5.",
  category: "video",
  schema: OmniHumanVideoSchema,
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const request = OmniHumanVideoSchema.parse(args);
      request.callBackUrl = ctx.getCallbackUrl(request.callBackUrl);
      const response = await ctx.client.generateOmniHumanVideo(request);
      if (response.code !== 200 || !response.data?.taskId) {
        throw new Error(response.msg || "Failed to create OmniHuman video task");
      }
      await ctx.db.createTask({
        task_id: response.data.taskId,
        api_type: "omnihuman-video",
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
                message: "OmniHuman 1.5 video task created successfully",
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      return ctx.formatError("omnihuman_video", error, {
        image_url: "Required: publicly accessible portrait image URL",
        audio_url: "Required: audio URL under 60 seconds",
        mask_url: "Optional: subject mask URLs (up to 5)",
      });
    }
  },
};

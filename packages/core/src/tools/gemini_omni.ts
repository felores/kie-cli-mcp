import { GeminiOmniSchema } from "../types.js";
import type { ToolDef, ToolContext, ToolResult } from "./types.js";

export const geminiOmniTool: ToolDef<typeof GeminiOmniSchema> = {
  name: "gemini_omni",
  description: "Create Gemini Omni videos or reusable Omni characters and voices from multimodal inputs.",
  category: "video",
  schema: GeminiOmniSchema,
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const request = GeminiOmniSchema.parse(args);
      request.callBackUrl = ctx.getCallbackUrl(request.callBackUrl);
      const response = await ctx.client.generateGeminiOmni(request);
      if (response.code !== 200 && response.code !== 0) throw new Error(response.msg || "Gemini Omni request failed");
      if (request.operation === "video") {
        const taskId = response.data?.taskId;
        if (!taskId) throw new Error("Gemini Omni did not return a task ID");
        await ctx.db.createTask({ task_id: taskId, api_type: "gemini-omni-video", status: "pending" });
      }
      return { content: [{ type: "text", text: JSON.stringify({ success: true, operation: request.operation || "video", data: response.data }, null, 2) }] };
    } catch (error) {
      return ctx.formatError("gemini_omni", error, { operation: 'Optional: "video" (default), "character", or "audio"' });
    }
  },
};

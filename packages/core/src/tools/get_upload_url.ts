import { z } from "zod";
import type { ToolDef, ToolContext, ToolResult } from "./types.js";

/**
 * Schema for the get_upload_url tool.
 *
 * This tool returns a one-time presigned upload URL. The client (LLM or
 * orchestrator) then PUTs the raw file bytes to that URL. After upload,
 * the file is available at a public download URL that can be passed to
 * any Kie.ai tool expecting a URL (e.g. reference_image_urls).
 */
export const GetUploadUrlSchema = z.object({
  filename: z
    .string()
    .min(1)
    .max(100)
    .describe("Filename including extension, e.g. 'reference.jpg'"),
  content_type: z
    .string()
    .optional()
    .describe(
      "MIME type, e.g. 'image/jpeg'. Auto-detected from extension when omitted.",
    ),
});

export type GetUploadUrlRequest = z.infer<typeof GetUploadUrlSchema>;

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
};

function mimeFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

export const getUploadUrlTool: ToolDef<typeof GetUploadUrlSchema> = {
  name: "get_upload_url",
  description:
    "Get a one-time presigned upload URL for a file. The client PUTs the raw file bytes to this URL, then receives a public download URL that can be used in any Kie.ai tool (e.g. as reference_image_urls in bytedance_seedance_video). No base64 needed — just PUT the file directly.",
  category: "utility",
  schema: GetUploadUrlSchema,
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const request = GetUploadUrlSchema.parse(args);
      const contentType =
        request.content_type ?? mimeFromFilename(request.filename);

      // Call our own upload endpoint to get a token
      // In production this is the same server; in dev it might be localhost
      const baseUrl =
        process.env.MCP_PUBLIC_URL || "http://localhost:3000";
      const tokenUrl = new URL("/upload/token", baseUrl);
      tokenUrl.searchParams.set("filename", request.filename);
      tokenUrl.searchParams.set("content_type", contentType);

      const response = await fetch(tokenUrl.toString());
      if (!response.ok) {
        throw new Error(
          `Failed to get upload token: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as {
        token: string;
        upload_url: string;
        download_url: string;
        expires_in_seconds: number;
        usage: string;
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                upload_url: data.upload_url,
                download_url: data.download_url,
                token: data.token,
                expires_in_seconds: data.expires_in_seconds,
                content_type: contentType,
                instructions: [
                  `PUT the raw file bytes to: ${data.upload_url}`,
                  `Content-Type header: ${contentType}`,
                  `After successful upload, the file is available at: ${data.download_url}`,
                  `Use download_url in tools expecting public URLs (e.g. reference_image_urls, first_frame_url)`,
                ],
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      return ctx.formatError("get_upload_url", error, {
        filename: "Required: filename with extension, e.g. 'ref.jpg'",
        content_type:
          "Optional: MIME type, auto-detected from extension when omitted",
      });
    }
  },
};

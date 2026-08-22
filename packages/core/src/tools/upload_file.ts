import { z } from "zod";
import type { ToolDef, ToolContext, ToolResult } from "./types.js";

/**
 * Schema for the upload_file tool.
 *
 * Two mutually exclusive ways to hand over the file:
 *  - file_base64: raw base64-encoded bytes (works with any LLM that can
 *    produce base64, e.g. from an attached image in OpenWebUI).
 *  - file_url:    any URL the MCP server can fetch (http/https). Use this
 *    when the file is already reachable somewhere — including OpenWebUI's
 *    own file endpoints (pass the Authorization token via auth_header if
 *    the endpoint requires it).
 */
export const UploadFileSchema = z
  .object({
    file_base64: z
      .string()
      .optional()
      .describe(
        "Base64-encoded file content. Use when the LLM has direct access to the file bytes (e.g. from a chat attachment). Mutually exclusive with file_url.",
      ),
    file_url: z
      .string()
      .url()
      .optional()
      .describe(
        "URL to download the file from (http/https). The MCP server fetches it server-side. Mutually exclusive with file_base64.",
      ),
    filename: z
      .string()
      .min(1)
      .describe(
        "Filename including extension, e.g. 'reference.jpg'. The extension determines the Content-Type if not given explicitly.",
      ),
    content_type: z
      .string()
      .optional()
      .describe(
        "MIME type, e.g. 'image/jpeg' or 'video/mp4'. Auto-detected from the filename extension when omitted.",
      ),
    auth_header: z
      .string()
      .optional()
      .describe(
        "Optional Authorization header value (e.g. 'Bearer <token>') used when downloading file_url. Needed for protected URLs like OpenWebUI's /api/v1/files/... endpoints.",
      ),
    upload_path: z
      .string()
      .optional()
      .describe(
        "Upload folder at the provider. Defaults to 'images'. Common values: 'images', 'videos', 'audios'.",
      ),
  })
  .refine(
    (v) =>
      (v.file_base64 !== undefined) !== (v.file_url !== undefined),
    {
      message:
        "Provide exactly one of file_base64 or file_url, not both and not neither.",
    },
  );

export type UploadFileRequest = z.infer<typeof UploadFileSchema>;

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

export const uploadFileTool: ToolDef<typeof UploadFileSchema> = {
  name: "upload_file",
  description:
    "Upload a file (image, video, audio) to Kie.ai and get back a public file URL. Use this before calling tools that need reference URLs (e.g. reference_image_urls in bytedance_seedance_video) when the source file is a local attachment, not yet a public URL. Accepts either base64 content or a URL to fetch.",
  category: "utility",
  schema: UploadFileSchema,
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const request = UploadFileSchema.parse(args);

      let bytes: Uint8Array;
      let contentType =
        request.content_type ?? mimeFromFilename(request.filename);

      if (request.file_base64 !== undefined) {
        // Direct base64 path — no network hop needed.
        bytes = new Uint8Array(Buffer.from(request.file_base64, "base64"));
      } else {
        // Fetch the file server-side (works for OpenWebUI file URLs etc.)
        const headers: Record<string, string> = {};
        if (request.auth_header) {
          headers["Authorization"] = request.auth_header;
        }
        const fetched = await ctx.client.downloadFile(request.file_url!, {
          maxBytes: 100 * 1024 * 1024, // 100 MB safety cap
          validateUrl: (url) => {
            if (!/^https?:\/\//i.test(url)) {
              throw new Error(
                `Refusing to download non-http(s) URL: ${url}`,
              );
            }
          },
        });
        if (fetched.bytes.length === 0) {
          throw new Error(
            `Downloaded file from ${request.file_url} is empty. If this is an OpenWebUI file URL, check that auth_header is set.`,
          );
        }
        bytes = fetched.bytes;
        if (!request.content_type && fetched.contentType) {
          contentType = fetched.contentType;
        }
      }

      if (bytes.length === 0) {
        throw new Error("File content is empty (0 bytes).");
      }
      if (bytes.length > 100 * 1024 * 1024) {
        throw new Error(
          `File too large: ${(bytes.length / 1024 / 1024).toFixed(1)} MB (max 100 MB)`,
        );
      }

      const response = await ctx.client.uploadFile({
        bytes,
        filename: request.filename,
        contentType,
      });

      // The provider nests the payload: data.downloadUrl is the public URL.
      // (Older docs mentioned data.fileUrl / top-level fileUrl — accept all.)
      const data: any = (response as any).data ?? {};
      const fileUrl: string | undefined =
        data.downloadUrl ?? data.fileUrl ?? (response as any).fileUrl;

      if (response.code === 200 && fileUrl) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  file_url: fileUrl,
                  filename: request.filename,
                  content_type: contentType,
                  size_bytes: bytes.length,
                  provider_file_name: data.fileName,
                  usage:
                    "Pass file_url in tools expecting public URLs, e.g. as first_frame_url or inside reference_image_urls of bytedance_seedance_video.",
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      throw new Error(
        `Upload response missing file URL (code=${response.code}, msg=${response.msg ?? "n/a"})`,
      );
    } catch (error) {
      return ctx.formatError("upload_file", error, {
        file_base64:
          "Provide this OR file_url: base64-encoded content of the file",
        file_url:
          "Provide this OR file_base64: http(s) URL the server can download",
        filename: "Required: filename with extension, e.g. 'ref.jpg'",
        content_type:
          "Optional: MIME type, auto-detected from extension when omitted",
        auth_header:
          "Optional: 'Bearer <token>' for protected file_url (e.g. OpenWebUI files)",
        upload_path:
          "Optional: provider upload folder, default 'images'",
      });
    }
  },
};

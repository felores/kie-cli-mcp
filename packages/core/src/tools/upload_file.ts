import type { SupportedUploadMimeType } from "../media-validation.js";
import {
  uploadPathForMimeType,
  validateUploadBytes,
} from "../media-validation.js";
import { UploadFileSchema } from "../types.js";
import type { ToolContext, ToolDef, ToolResult } from "./types.js";

const MAX_DECODED_BYTES = 10 * 1024 * 1024;

function decodeBase64(
  value: string,
  declaredType?: string,
): {
  bytes: Uint8Array;
  providerValue: string;
  contentType: SupportedUploadMimeType;
} {
  const match = value.match(/^data:([^;,]+);base64,(.*)$/s);
  const contentType = match?.[1] ?? declaredType;
  const encoded = (match?.[2] ?? value).replace(/\s+/g, "");
  if (
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      encoded,
    )
  ) {
    throw new Error("file_base64 is not valid Base64.");
  }
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length > MAX_DECODED_BYTES) {
    throw new Error("file_base64 exceeds the 10 MiB decoded limit.");
  }
  const detectedType = validateUploadBytes(bytes, contentType);
  return {
    bytes,
    providerValue: `data:${detectedType};base64,${encoded}`,
    contentType: detectedType,
  };
}

export const uploadFileTool: ToolDef<typeof UploadFileSchema> = {
  name: "upload_file",
  description:
    "Upload validated media directly to Kie.ai from Base64 or a CLI-approved local file path. Arbitrary URL imports are intentionally unsupported to avoid delegated SSRF.",
  category: "utility",
  schema: UploadFileSchema,
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const request = UploadFileSchema.parse(args);
      const response = request.file_path
        ? await (async () => {
            if (!ctx.readLocalUpload) {
              throw new Error(
                "file_path is available only to the CLI when KIE_CLI_UPLOAD_ROOTS is configured.",
              );
            }
            const file = await ctx.readLocalUpload(
              request.file_path!,
              25 * 1024 * 1024,
            );
            const contentType = validateUploadBytes(
              file.bytes,
              file.contentType,
            );
            return ctx.client.uploadFile(
              {
                bytes: file.bytes,
                filename: request.file_name ?? file.filename,
                contentType,
              },
              uploadPathForMimeType(contentType),
            );
          })()
        : await (async () => {
            const decoded = decodeBase64(
              request.file_base64!,
              request.content_type,
            );
            return ctx.client.uploadBase64({
              base64Data: decoded.providerValue,
              uploadPath: uploadPathForMimeType(decoded.contentType),
              ...(request.file_name ? { fileName: request.file_name } : {}),
            });
          })();

      const downloadUrl = response.data?.downloadUrl ?? response.data?.fileUrl;
      if ((response.code !== 200 && response.code !== 0) || !downloadUrl) {
        throw new Error(response.msg || "Kie.ai did not return a downloadUrl.");
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                download_url: downloadUrl,
                file_name: response.data?.fileName,
                file_size: response.data?.fileSize,
                mime_type: response.data?.mimeType,
                retention:
                  "Temporary provider URL. Consume promptly; official Kie documentation is inconsistent between 24 hours and 3 days.",
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      return ctx.formatError("upload_file", error, {
        file_base64: "Base64 media or data URL, maximum 10 MiB decoded",
        file_path:
          "CLI-only local file under KIE_CLI_UPLOAD_ROOTS, maximum 25 MiB",
        file_name: "Optional filename without path separators",
        content_type:
          "Required for raw Base64 when MIME cannot be inferred inline",
      });
    }
  },
};

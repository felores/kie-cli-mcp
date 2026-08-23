import { jest } from "@jest/globals";
import type { ToolContext } from "../tools/types.js";
import { uploadFileTool } from "../tools/upload_file.js";
import { GetUploadUrlSchema, UploadFileSchema } from "../types.js";

function pngDataUrl(): string {
  return `data:image/png;base64,${Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
  ]).toString("base64")}`;
}

function context(overrides: Partial<ToolContext["client"]> = {}): ToolContext {
  return {
    client: {
      uploadBase64: jest.fn(async () => ({
        code: 200,
        msg: "ok",
        data: {
          downloadUrl: "https://tempfile.redpandaai.co/reference.png",
        },
      })),
      uploadFromUrl: jest.fn(async () => ({
        code: 200,
        msg: "ok",
        data: {
          downloadUrl: "https://tempfile.redpandaai.co/reference.png",
        },
      })),
      uploadFile: jest.fn(async () => ({
        code: 200,
        msg: "ok",
        data: {
          downloadUrl: "https://tempfile.redpandaai.co/reference.png",
        },
      })),
      ...overrides,
    } as ToolContext["client"],
    db: {} as ToolContext["db"],
    approvalContext: "test",
    getCallbackUrl: (value) => value ?? "",
    formatError: (_tool, error) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      ],
    }),
    getTool: () => undefined,
  };
}

describe("UploadFileSchema", () => {
  test("requires exactly one Base64 or CLI path source", () => {
    expect(UploadFileSchema.safeParse({}).success).toBe(false);
    expect(
      UploadFileSchema.safeParse({
        file_path: "/allowed/a.png",
        file_base64: pngDataUrl(),
      }).success,
    ).toBe(false);
    expect(
      UploadFileSchema.safeParse({
        file_path: "/allowed/a.png",
        content_type: "image/png",
      }).success,
    ).toBe(false);
  });

  test("rejects hostile filenames before temporary storage", () => {
    for (const filename of [
      "../secret.png",
      "folder/file.png",
      "evil\r\nX-Test: yes.png",
    ]) {
      expect(
        GetUploadUrlSchema.safeParse({
          app_grant: "g".repeat(43),
          filename,
          content_type: "image/png",
          size: 9,
        }).success,
      ).toBe(false);
    }
  });
});

describe("upload_file tool", () => {
  test("validates Base64 bytes before calling Kie", async () => {
    const ctx = context();
    const result = await uploadFileTool.run(
      { file_base64: "not-base64", content_type: "image/png" },
      ctx,
    );
    expect(JSON.parse(result.content[0].text)).toMatchObject({
      success: false,
    });
    expect(ctx.client.uploadBase64).not.toHaveBeenCalled();
  });

  test("uploads validated Base64 using a media-specific path", async () => {
    const ctx = context();
    const result = await uploadFileTool.run({ file_base64: pngDataUrl() }, ctx);
    expect(ctx.client.uploadBase64).toHaveBeenCalledWith(
      expect.objectContaining({ uploadPath: "images/user-uploads" }),
    );
    expect(JSON.parse(result.content[0].text)).toMatchObject({
      success: true,
      download_url: "https://tempfile.redpandaai.co/reference.png",
    });
  });

  test("accepts local paths only through the CLI adapter capability", async () => {
    const ctx = context();
    ctx.readLocalUpload = async () => ({
      bytes: Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
      ]),
      filename: "reference.png",
      contentType: "image/png",
    });
    await uploadFileTool.run({ file_path: "/allowed/reference.png" }, ctx);
    expect(ctx.client.uploadFile).toHaveBeenCalledWith(
      expect.objectContaining({ filename: "reference.png" }),
      "images/user-uploads",
    );
  });

  test("rejects local paths on non-CLI adapters", async () => {
    const ctx = context();
    const result = await uploadFileTool.run({ file_path: "/etc/passwd" }, ctx);
    expect(JSON.parse(result.content[0].text)).toMatchObject({
      success: false,
    });
    expect(ctx.client.uploadFile).not.toHaveBeenCalled();
  });
});

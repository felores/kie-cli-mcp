import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "@jest/globals";
import { createToolContext } from "../context.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) =>
      rm(path, { recursive: true, force: true }),
    ),
  );
});

describe("CLI local upload roots", () => {
  test("reads validated files only below configured roots", async () => {
    const root = await mkdtemp(join(tmpdir(), "kie-cli-root-"));
    const outside = await mkdtemp(join(tmpdir(), "kie-cli-outside-"));
    directories.push(root, outside);
    const allowedFile = join(root, "reference.png");
    const deniedFile = join(outside, "secret.png");
    const bytes = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
    ]);
    await Promise.all([
      writeFile(allowedFile, bytes),
      writeFile(deniedFile, bytes),
    ]);
    const previousKey = process.env.KIE_AI_API_KEY;
    const previousRoots = process.env.KIE_CLI_UPLOAD_ROOTS;
    const previousDb = process.env.KIE_AI_DB_PATH;
    process.env.KIE_AI_API_KEY = "test-key-no-network";
    process.env.KIE_CLI_UPLOAD_ROOTS = root;
    process.env.KIE_AI_DB_PATH = join(root, "tasks.db");
    const context = createToolContext();
    try {
      await expect(context.readLocalUpload?.(allowedFile, 1024)).resolves.toMatchObject({
        filename: "reference.png",
        contentType: "image/png",
      });
      await expect(context.readLocalUpload?.(deniedFile, 1024)).rejects.toThrow(
        /outside KIE_CLI_UPLOAD_ROOTS/,
      );
    } finally {
      await context.db.close();
      if (previousKey === undefined) delete process.env.KIE_AI_API_KEY;
      else process.env.KIE_AI_API_KEY = previousKey;
      if (previousRoots === undefined) delete process.env.KIE_CLI_UPLOAD_ROOTS;
      else process.env.KIE_CLI_UPLOAD_ROOTS = previousRoots;
      if (previousDb === undefined) delete process.env.KIE_AI_DB_PATH;
      else process.env.KIE_AI_DB_PATH = previousDb;
    }
  });
});

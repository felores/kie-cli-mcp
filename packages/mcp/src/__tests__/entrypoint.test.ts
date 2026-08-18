import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "@jest/globals";
import { isMcpEntrypoint } from "../index.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("MCP entrypoint detection", () => {
  test("recognizes an npm-style bin symlink to the server module", async () => {
    const directory = await mkdtemp(join(tmpdir(), "kie-mcp-entrypoint-"));
    temporaryDirectories.push(directory);
    const modulePath = join(directory, "dist", "index.js");
    const binPath = join(directory, ".bin", "kie-ai-mcp-server");

    await Promise.all([
      mkdir(join(directory, "dist")),
      mkdir(join(directory, ".bin")),
    ]);
    await writeFile(modulePath, "");
    await symlink(modulePath, binPath);

    expect(isMcpEntrypoint(binPath, modulePath)).toBe(true);
  });

  test("does not recognize unrelated paths or missing entrypoints", () => {
    expect(isMcpEntrypoint(undefined, process.execPath)).toBe(false);
    expect(isMcpEntrypoint("/missing/kie-ai-mcp-server", process.execPath)).toBe(false);
  });
});

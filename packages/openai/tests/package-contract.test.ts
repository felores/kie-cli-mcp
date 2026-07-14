import { spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));

test("published manifest does not depend on the private core package", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  ) as {
    bin?: Record<string, string>;
    dependencies?: Record<string, string>;
    version: string;
  };

  expect(packageJson.version).toBe("0.1.1");
  expect(packageJson.dependencies).not.toHaveProperty("@felores/kie-ai-core");
  expect(packageJson.bin).toEqual({
    "kie-ai-openai-server": "dist/bin.js",
  });
});

test("bundle is self-contained and importable without a core package import", async () => {
  const files = await readdir(new URL("../dist", import.meta.url));
  expect(files).toEqual(
    expect.arrayContaining([
      "bin.js",
      "index.d.ts",
      "index.js",
      "standalone.d.ts",
      "standalone.js",
    ]),
  );

  const bundle = await readFile(new URL("../dist/index.js", import.meta.url), "utf8");
  expect(bundle).not.toContain("@felores/kie-ai-core");

  const imported = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      "import { createKieOpenAiRouter } from './dist/index.js'; if (typeof createKieOpenAiRouter !== 'function') process.exit(1); createKieOpenAiRouter({});",
    ],
    { cwd: packageRoot, encoding: "utf8" },
  );
  expect(imported.stderr).toBe("");
  expect(imported.status).toBe(0);
});

test("standalone binary executes instead of silently exiting", () => {
  const executed = spawnSync(process.execPath, ["dist/bin.js"], {
    cwd: packageRoot,
    encoding: "utf8",
    env: { ...process.env, KIE_OPENAI_TOKEN: "" },
  });
  expect(executed.status).not.toBe(0);
  expect(executed.stderr).toContain(
    "KIE_OPENAI_TOKEN is required for standalone mode.",
  );
});

test("dry-run package contains only the public runtime contract", () => {
  const packed = spawnSync(
    "npm",
    ["pack", "--dry-run", "--json", "--ignore-scripts"],
    { cwd: packageRoot, encoding: "utf8" },
  );
  expect(packed.stderr).toBe("");
  expect(packed.status).toBe(0);

  const output = JSON.parse(packed.stdout) as Array<{
    files: Array<{ path: string }>;
  }>;
  const paths = output[0]?.files.map((file) => file.path) ?? [];
  expect(paths).toEqual(
    expect.arrayContaining([
      "LICENSE",
      "README.md",
      "dist/bin.js",
      "dist/index.d.ts",
      "dist/index.js",
      "dist/standalone.js",
      "package.json",
    ]),
  );
  expect(paths.some((path) => path.startsWith("src/"))).toBe(false);
  expect(paths.some((path) => path.startsWith("tests/"))).toBe(false);
});

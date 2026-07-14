import { build } from "esbuild";
import { chmod, readFile, rm } from "node:fs/promises";

const packageJson = JSON.parse(
  await readFile(new URL("./package.json", import.meta.url), "utf8"),
);

await rm(new URL("./dist/index.js", import.meta.url), { force: true });
await rm(new URL("./dist/standalone.js", import.meta.url), { force: true });
await rm(new URL("./dist/bin.js", import.meta.url), { force: true });

await build({
  entryPoints: ["src/index.ts", "src/standalone.ts", "src/bin.ts"],
  outdir: "dist",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  sourcemap: true,
  external: ["express", "sqlite3"],
  define: {
    __PACKAGE_VERSION__: JSON.stringify(packageJson.version),
  },
  banner: {
    js: "#!/usr/bin/env node",
  },
});

await chmod(new URL("./dist/bin.js", import.meta.url), 0o755);

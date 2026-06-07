// Publish bundle: inline @felores/kie-ai-core into a single self-contained file
// so the published package never depends on the unpublished core workspace.
// Third-party runtime deps stay external (declared in package.json); sqlite3 is
// a native module and MUST stay external.
import { build } from "esbuild";
import { readFileSync } from "fs";

const OUT = "dist/index.js";

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  outfile: OUT,
  external: ["sqlite3", "@modelcontextprotocol/sdk", "zod", "express"],
  logLevel: "info",
});

// Guard: the published artifact must never reference the unpublished core.
if (readFileSync(OUT, "utf8").includes("@felores/kie-ai-core")) {
  console.error(
    `FATAL: ${OUT} still references @felores/kie-ai-core; core was not inlined.`,
  );
  process.exit(1);
}

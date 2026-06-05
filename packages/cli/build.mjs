// Publish bundle: inline @felores/kie-ai-core into a single self-contained file.
// Third-party runtime deps stay external; sqlite3 is native and MUST stay external.
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
  external: ["sqlite3", "yargs", "zod"],
  logLevel: "info",
});

// Guard: the published artifact must never reference the unpublished core.
if (readFileSync(OUT, "utf8").includes("@felores/kie-ai-core")) {
  console.error(
    `FATAL: ${OUT} still references @felores/kie-ai-core; core was not inlined.`,
  );
  process.exit(1);
}

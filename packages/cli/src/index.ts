#!/usr/bin/env node
// Standalone Kie.ai CLI. Every command and its flags are derived from
// @felores/kie-ai-core's TOOL_REGISTRY, so the CLI and the MCP server always
// expose the exact same tools. Run `kie-cli --help` to list them.
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import {
  TOOL_REGISTRY,
  toInputJsonSchema,
  createToolContext,
  type ToolDef,
  type ToolContext,
} from "@felores/kie-ai-core";

interface JsonProp {
  type?: string | string[];
  description?: string;
  default?: unknown;
  enum?: unknown[];
  items?: { type?: string };
}

/** A property that can't be a flat flag (nested object / array of objects) is taken as a JSON string. */
function isJsonProp(p: JsonProp): boolean {
  return (
    p.type === "object" || (p.type === "array" && p.items?.type === "object")
  );
}

function optionConfig(p: JsonProp, required: boolean) {
  const json = isJsonProp(p);
  const type = json
    ? "string"
    : p.type === "integer"
      ? "number"
      : p.type === "array"
        ? "array"
        : (p.type as "string" | "number" | "boolean" | undefined);

  const cfg: Record<string, unknown> = {
    describe: (p.description || "") + (json ? " (pass as JSON)" : ""),
    demandOption: required,
  };
  if (type) cfg.type = type;
  if (p.enum) cfg.choices = p.enum;
  if (p.default !== undefined && !json) cfg.default = p.default;
  return cfg;
}

async function runTool(
  tool: ToolDef,
  props: Record<string, JsonProp>,
  argv: Record<string, unknown>,
  ctx: ToolContext,
): Promise<void> {
  const args: Record<string, unknown> = {};
  for (const [key, p] of Object.entries(props)) {
    let value = argv[key];
    if (value === undefined) continue;
    if (isJsonProp(p) && typeof value === "string") {
      try {
        value = JSON.parse(value);
      } catch {
        throw new Error(`Option --${key} must be valid JSON`);
      }
    }
    args[key] = value;
  }

  const result = await tool.run(args, ctx);
  const text = result.content?.[0]?.text ?? "";

  if (argv.json) {
    process.stdout.write(text + "\n");
  } else {
    try {
      console.log(JSON.stringify(JSON.parse(text), null, 2));
    } catch {
      console.log(text);
    }
  }

  // Exit non-zero when the tool reported a failure.
  try {
    const parsed = JSON.parse(text);
    if (parsed && parsed.success === false) process.exitCode = 1;
  } catch {
    /* leave exit code as-is */
  }
}

function build() {
  let cli = yargs(hideBin(process.argv))
    .scriptName("kie-cli")
    .usage(
      "$0 <tool> [options]\n\nGenerate images, video, music and speech via Kie.ai.",
    )
    .option("json", {
      type: "boolean",
      default: false,
      describe: "Output raw JSON (machine-readable)",
    })
    .demandCommand(
      1,
      "Specify a tool. Run `kie-cli --help` to list available tools.",
    )
    .recommendCommands()
    .strict()
    .wrap(Math.min(120, process.stdout.columns || 120))
    .help()
    .alias("h", "help")
    .version(false);

  for (const tool of TOOL_REGISTRY) {
    const js = toInputJsonSchema(tool.schema);
    const props = (js.properties as Record<string, JsonProp>) || {};
    const required = (js.required as string[]) || [];

    cli = cli.command(
      tool.name,
      `[${tool.category}] ${tool.description}`,
      (y) => {
        for (const [key, p] of Object.entries(props)) {
          y.option(key, optionConfig(p, required.includes(key)));
        }
        return y;
      },
      async (argv) => {
        const ctx = createToolContext();
        await runTool(tool, props, argv as Record<string, unknown>, ctx);
      },
    );
  }

  return cli;
}

build()
  .fail((msg, err, y) => {
    if (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
    console.error(msg + "\n");
    y.showHelp();
    process.exit(1);
  })
  .parseAsync()
  .catch((err) => {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });

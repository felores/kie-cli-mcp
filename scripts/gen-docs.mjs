#!/usr/bin/env node
// Generate docs/TOOLS.md from the tool registry, so it never drifts.
// Run via `npm run docs` (which builds core first).
import fs from "fs";
import { TOOL_REGISTRY, toolToMarkdown } from "../packages/core/dist/index.js";

const CATEGORIES = [
  ["image", "Image"],
  ["video", "Video"],
  ["audio", "Audio"],
  ["utility", "Utility"],
];

const inCategory = (cat) =>
  TOOL_REGISTRY.filter((t) => t.category === cat).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

let out = "# Kie.ai Tool Reference\n\n";
out +=
  "> Generated from the tool registry. Do not edit by hand, run `npm run docs` to regenerate.\n\n";
out +=
  "Every tool below is available in both the MCP server and the `kie-cli` CLI. " +
  "Parameters are derived from each tool's schema, so this list always matches the code.\n\n";

// Table of contents
out += "## Contents\n\n";
for (const [cat, label] of CATEGORIES) {
  const tools = inCategory(cat);
  if (!tools.length) continue;
  out += `- **${label}:** `;
  out += tools.map((t) => `[${t.name}](#${t.name})`).join(", ");
  out += "\n";
}
out += "\n---\n\n";

// Per-category sections
for (const [cat, label] of CATEGORIES) {
  const tools = inCategory(cat);
  if (!tools.length) continue;
  out += `## ${label} tools\n\n`;
  for (const t of tools) {
    const md = toolToMarkdown(t)
      .replace(/^# /, "### ") // tool name: h1 -> h3 (under the category h2)
      .replace(/\*\*Category:\*\* [a-z]+\n\n/, "") // redundant (grouped by category)
      .replace(/\n## Parameters/, "\n#### Parameters");
    out += md.trimEnd() + "\n\n";
  }
}

fs.writeFileSync(new URL("../docs/TOOLS.md", import.meta.url), out);
console.log(
  `Wrote docs/TOOLS.md (${TOOL_REGISTRY.length} tools across ${CATEGORIES.length} categories).`,
);

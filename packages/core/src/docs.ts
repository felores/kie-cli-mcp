import type { ToolDef, ToolCategory } from "./tools/types.js";
import { toInputJsonSchema } from "./json-schema.js";

interface JsonProp {
  type?: string | string[];
  description?: string;
  default?: unknown;
  enum?: unknown[];
}

function typeLabel(p: JsonProp): string {
  if (p.enum) return p.enum.map((v) => `\`${v}\``).join(" / ");
  if (Array.isArray(p.type)) return p.type.join(" \\| ");
  return p.type || "any";
}

/**
 * Render a tool as Markdown reference, derived entirely from its registry entry
 * and Zod schema. Always accurate, never drifts, never reads a file.
 */
export function toolToMarkdown(tool: ToolDef): string {
  const js = toInputJsonSchema(tool.schema) as {
    properties?: Record<string, JsonProp>;
    required?: string[];
  };
  const props = js.properties || {};
  const required = new Set(js.required || []);
  const keys = Object.keys(props);

  let md = `# ${tool.name}\n\n`;
  md += `**Category:** ${tool.category}\n\n`;
  md += `${tool.description}\n\n`;
  md += `## Parameters\n\n`;

  if (keys.length === 0) {
    md += "_This tool takes no parameters._\n";
    return md;
  }

  md += "| Parameter | Type | Required | Description |\n";
  md += "| --- | --- | --- | --- |\n";
  for (const k of keys) {
    const p = props[k];
    const desc = (p.description || "")
      .replace(/\n/g, " ")
      .replace(/\|/g, "\\|");
    const def =
      p.default !== undefined
        ? ` (default: \`${JSON.stringify(p.default)}\`)`
        : "";
    md += `| \`${k}\` | ${typeLabel(p)} | ${required.has(k) ? "yes" : "no"} | ${desc}${def} |\n`;
  }
  return md;
}

/**
 * Build the guidance text for a category prompt (e.g. "image", "video") from the
 * tools currently in the registry for that category.
 */
export function categoryPromptText(
  category: ToolCategory,
  tools: ToolDef[],
): string {
  const inCat = tools.filter((t) => t.category === category);
  const verb =
    category === "image"
      ? "generate, edit and enhance images"
      : category === "video"
        ? "generate and transform videos"
        : `use the ${category} tools`;

  let md = `You can ${verb} using these Kie.ai tools. Choose the one that fits the request and call it with its parameters.\n\n`;
  md += `Generation is asynchronous: most tools return a task id. Poll progress with \`get_task_status\` and review recent work with \`list_tasks\`.\n\n`;

  for (const t of inCat) {
    const js = toInputJsonSchema(t.schema) as {
      properties?: Record<string, JsonProp>;
      required?: string[];
    };
    const required = (js.required || []).map((r) => `\`${r}\``);
    md += `## ${t.name}\n${t.description}\n`;
    md += required.length
      ? `Required: ${required.join(", ")}\n\n`
      : `No required parameters.\n\n`;
  }
  return md;
}

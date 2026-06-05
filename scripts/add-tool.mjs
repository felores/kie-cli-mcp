#!/usr/bin/env node
// Scaffold a new Kie.ai tool. Adding a model = run this, fill the schema + client
// method, done. The MCP server and the CLI both pick it up from the registry.
//
// Usage: npm run add-tool -- <tool_name> [image|video|audio|utility]
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOOLS = path.join(ROOT, "packages/core/src/tools");

const name = process.argv[2];
const category = process.argv[3] || "image";

if (!name || !/^[a-z][a-z0-9_]*$/.test(name)) {
  console.error("Usage: npm run add-tool -- <tool_name> [image|video|audio|utility]");
  console.error("  tool_name must be snake_case, e.g. acme_new_video");
  process.exit(1);
}
if (!["image", "video", "audio", "utility"].includes(category)) {
  console.error(`Invalid category "${category}". Use image | video | audio | utility.`);
  process.exit(1);
}

const file = path.join(TOOLS, `${name}.ts`);
if (fs.existsSync(file)) {
  console.error(`Tool file already exists: ${file}`);
  process.exit(1);
}

const camel = name.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
const varName = `${camel}Tool`;
const Schema = `${camel.charAt(0).toUpperCase() + camel.slice(1)}Schema`;

const skeleton = `import { z } from "zod";
import type { ToolDef, ToolContext, ToolResult } from "./types.js";

// TODO: move this schema into ../types.js (export const ${Schema}) and import it
// here, so it lives next to the other tool schemas.
const ${Schema} = z.object({
  prompt: z.string().min(1).describe("Text prompt"),
});

export const ${varName}: ToolDef<typeof ${Schema}> = {
  name: ${JSON.stringify(name)},
  description: "TODO: one-line description shown in MCP listTools and CLI help",
  category: ${JSON.stringify(category)},
  schema: ${Schema},
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const request = ${Schema}.parse(args);

      // TODO: add the client method in packages/core/src/kie-ai-client.ts and call it:
      // const response = await ctx.client.generate${camel.charAt(0).toUpperCase() + camel.slice(1)}(request);
      // if (response.data?.taskId) {
      //   await ctx.db.createTask({ task_id: response.data.taskId, api_type: "..." as any, status: "pending" });
      // }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { success: true, request, message: "TODO: implement ${name}" },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      return ctx.formatError(${JSON.stringify(name)}, error, {
        prompt: "Required: text prompt",
      });
    }
  },
};
`;

fs.writeFileSync(file, skeleton);

// Wire into the registry index.ts: add the import and the array entry.
const indexPath = path.join(TOOLS, "index.ts");
let index = fs.readFileSync(indexPath, "utf8");

const importLine = `import { ${varName} } from "./${name}.js";`;
// insert import after the last existing tool import
const lastImport = index.lastIndexOf('Tool } from "./');
const lineEnd = index.indexOf("\n", lastImport);
index = index.slice(0, lineEnd + 1) + importLine + "\n" + index.slice(lineEnd + 1);

// insert entry before the closing "];" of TOOL_REGISTRY
index = index.replace(/\n\];/, `\n  ${varName},\n];`);

fs.writeFileSync(indexPath, index);

console.log(`✓ Created ${path.relative(ROOT, file)}`);
console.log(`✓ Registered ${varName} in tools/index.ts`);
console.log("\nNext steps:");
console.log(`  1. Move the Zod schema into packages/core/src/types.ts (export const ${Schema}).`);
console.log("  2. Add the API method in packages/core/src/kie-ai-client.ts.");
console.log("  3. Fill in description, run() body and the db api_type.");
console.log("  4. Update EXPECTED_TOOL_NAMES in packages/core/src/__tests__/registry.test.ts.");
console.log("  5. npm run build && npm test");

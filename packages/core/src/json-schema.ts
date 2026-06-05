import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * Derive a tool's MCP `inputSchema` (JSON Schema 7) from its Zod schema.
 * Single definition used by both the MCP server and the CLI so the advertised
 * schema and the parsed flags always come from the same place.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toInputJsonSchema(schema: any): Record<string, unknown> {
  const js = zodToJsonSchema(schema, {
    target: "jsonSchema7",
    $refStrategy: "none",
  }) as Record<string, unknown>;
  delete js.$schema;
  return js;
}

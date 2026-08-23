import { z } from "zod";

/**
 * Derive a tool's MCP `inputSchema` from its Zod schema. Single definition used
 * by both the MCP server and the CLI so the advertised schema and the parsed
 * flags always come from the same place.
 *
 * Uses zod4's native converter, which emits JSON Schema 2020-12: the dialect MCP
 * 2026-07-28 targets. Two adjustments keep MCP tool semantics unchanged:
 * - Fields with a default are no longer `required` (clients may omit them and
 *   rely on the server-side default), matching the pre-zod4 output.
 * - `additionalProperties` is not advertised (zod strips unknown keys at parse
 *   time, so unknown parameters remain tolerated).
 */
export function toInputJsonSchema(
  schema: z.ZodTypeAny,
): Record<string, unknown> {
  const js = z.toJSONSchema(schema) as Record<string, unknown>;
  delete js.$schema;
  delete js.additionalProperties;

  const required = Array.isArray(js.required) ? (js.required as string[]) : [];
  const properties = (js.properties ?? {}) as Record<
    string,
    { default?: unknown }
  >;
  const defaulted = required.filter(
    (name) => name in properties && "default" in properties[name],
  );
  if (defaulted.length > 0) {
    const remaining = required.filter((name) => !defaulted.includes(name));
    if (remaining.length > 0) js.required = remaining;
    else delete js.required;
  }

  return js;
}

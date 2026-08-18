import { ListModelsSchema } from "../types.js";
import { filterCatalog } from "../model-catalog.js";
import type { ToolDef, ToolContext, ToolResult } from "./types.js";

export const listModelsTool: ToolDef<typeof ListModelsSchema> = {
  name: "list_models",
  description: "List source-backed catalog models. Filter by words from capabilities, model names, or descriptions.",
  category: "utility",
  schema: ListModelsSchema,
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const { filter } = ListModelsSchema.parse(args);
      const models = filterCatalog(filter);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            filter: filter ?? null,
            models,
            count: models.length,
            note: "Capabilities and descriptions are catalog metadata. Follow each evidenceUrl for provider facts.",
          }, null, 2),
        }],
      };
    } catch (error) {
      return ctx.formatError("list_models", error, { filter: "Optional capability or text filter, for example: lip sync" });
    }
  },
};

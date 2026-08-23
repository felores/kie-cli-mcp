import { ListTasksSchema } from "../types.js";
import type { ToolContext, ToolDef, ToolResult } from "./types.js";

export const listTasksTool: ToolDef<typeof ListTasksSchema> = {
  name: "list_tasks",
  description: "List recent tasks with their status",
  category: "utility",
  schema: ListTasksSchema,
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const { limit = 20, status } = ListTasksSchema.parse(args);

      const tasks = status
        ? await ctx.db.getTasksByStatus(status, limit)
        : await ctx.db.getAllTasks(limit);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                tasks: tasks,
                count: tasks.length,
                message: `Retrieved ${tasks.length} tasks`,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      return ctx.formatError("list_tasks", error, {
        limit: "Optional: max tasks to return (1-100, default: 20)",
        status:
          "Optional: filter by status (pending, processing, completed, failed)",
      });
    }
  },
};

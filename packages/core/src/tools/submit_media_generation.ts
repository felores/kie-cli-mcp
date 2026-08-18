import { hashPlanPayload } from "../generation-plan.js";
import { SubmitMediaGenerationSchema } from "../types.js";
import type { ToolDef, ToolContext, ToolResult } from "./types.js";

interface SubmissionResult {
  index: number;
  tool: string;
  taskId?: string;
  result: unknown;
  error?: string;
}

function parseToolResult(result: ToolResult): unknown {
  const text = result.content[0]?.text ?? "";
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractTaskId(result: unknown): string | undefined {
  if (!result || typeof result !== "object") return undefined;
  const data = result as { task_id?: unknown; response?: { data?: { taskId?: unknown } } };
  if (typeof data.task_id === "string") return data.task_id;
  return typeof data.response?.data?.taskId === "string" ? data.response.data.taskId : undefined;
}

function resultError(envelope: ToolResult, result: unknown): string | undefined {
  if (envelope.isError) return "Target tool returned an error envelope.";
  if (!result || typeof result !== "object") return undefined;
  const payload = result as { success?: unknown; error?: unknown };
  if (payload.success !== false) return undefined;
  return typeof payload.error === "string" ? payload.error : "Target tool reported failure.";
}

async function withConcurrency<T>(items: T[], limit: number, run: (item: T) => Promise<SubmissionResult>): Promise<SubmissionResult[]> {
  const results: SubmissionResult[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await run(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export const submitMediaGenerationTool: ToolDef<typeof SubmitMediaGenerationSchema> = {
  name: "submit_media_generation",
  description: "Submit a single unexpired, unchanged plan approved in this caller context exactly once. The persisted approval state is the authorization boundary; the plan hash detects accidental mutation only. The stored plan controls a maximum of four concurrent task creates.",
  category: "utility",
  schema: SubmitMediaGenerationSchema,
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const { planId } = SubmitMediaGenerationSchema.parse(args);
      const stored = await ctx.db.getGenerationPlan(planId);
      if (!stored) throw new Error("Prepared plan not found.");
      const { plan } = stored;
      const computedHash = hashPlanPayload({
        createdAt: plan.createdAt,
        expiresAt: plan.expiresAt,
        defaultProfile: plan.defaultProfile,
        maxConcurrency: plan.maxConcurrency,
        items: plan.items,
        total: plan.total,
      });
      if (plan.id !== planId || plan.requestHash !== stored.requestHash || computedHash !== stored.requestHash) {
        throw new Error("Prepared plan integrity check failed.");
      }
      if (new Date(plan.expiresAt).getTime() <= Date.now()) throw new Error("Prepared plan has expired.");
      if (stored.status !== "approved") {
        throw new Error("Plan is not approved, has already been submitted, or is being submitted.");
      }
      const unavailableTools = [...new Set(plan.items.map((item) => item.tool))]
        .filter((name) => !ctx.getTool(name));
      if (unavailableTools.length > 0) {
        throw new Error(`Prepared plan contains unavailable tool(s): ${unavailableTools.join(", ")}.`);
      }
      if (!await ctx.db.claimGenerationPlan(planId, stored.requestHash, ctx.approvalContext)) {
        throw new Error("Approved plan is unavailable in this approval context, expired, changed, or already submitted.");
      }
      const results = await withConcurrency(plan.items, plan.maxConcurrency, async (item) => {
        const target = ctx.getTool(item.tool);
        if (!target) {
          throw new Error(`Prepared plan contains unavailable tool: ${item.tool}.`);
        }
        try {
          const envelope = await target.run(item.effectiveSettings, ctx);
          const result = parseToolResult(envelope);
          const error = resultError(envelope, result);
          return {
            index: item.index,
            tool: item.tool,
            taskId: extractTaskId(result),
            result,
            ...(error ? { error } : {}),
          };
        } catch (error) {
          return {
            index: item.index,
            tool: item.tool,
            result: null,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });
      if (results.some((result) => result.error)) {
        await ctx.db.failGenerationPlan(planId, results);
        throw new Error("One or more plan items failed.");
      }
      await ctx.db.finishGenerationPlan(planId, results);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: true, planId, requestHash: stored.requestHash, results }, null, 2),
        }],
      };
    } catch (error) {
      return ctx.formatError("submit_media_generation", error, {
        planId: "Required: an unexpired, approved plan ID returned by prepare_media_generation",
      });
    }
  },
};

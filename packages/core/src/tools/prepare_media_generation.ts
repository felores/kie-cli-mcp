import { prepareGenerationPlan } from "../generation-plan.js";
import { PrepareMediaGenerationSchema } from "../types.js";
import type { PlanApprovalDecision, ToolDef, ToolContext, ToolResult } from "./types.js";

function pendingResult(
  plan: ReturnType<typeof prepareGenerationPlan>,
  reason: string,
): ToolResult {
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        planId: plan.id,
        plan,
        status: "prepared",
        approved: false,
        reason,
        message: "No provider task was created. This plan remains unapproved and cannot be submitted.",
      }, null, 2),
    }],
  };
}

export const prepareMediaGenerationTool: ToolDef<typeof PrepareMediaGenerationSchema> = {
  name: "prepare_media_generation",
  description: "Prepare one to six validated media generations, resolve safe defaults and pricing, persist a caller-context-bound plan, then request host approval when the transport supports it without calling a provider.",
  category: "utility",
  schema: PrepareMediaGenerationSchema,
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const request = PrepareMediaGenerationSchema.parse(args);
      const tools = new Map(request.items.map((item) => [item.tool, ctx.getTool(item.tool)]).filter((entry): entry is [string, ToolDef] => entry[1] !== undefined));
      const plan = prepareGenerationPlan(request.items, tools, {
        defaultProfile: request.defaultProfile,
        maxConcurrency: request.maxConcurrency,
        expiresInSeconds: request.expiresInSeconds,
      });
      await ctx.db.createGenerationPlan(plan, ctx.approvalContext);
      if (!ctx.requestPlanApproval) {
        return pendingResult(
          plan,
          "This transport cannot request approval during preparation. Use its explicit approval boundary before submission.",
        );
      }

      let decision: PlanApprovalDecision;
      try {
        decision = await ctx.requestPlanApproval(plan);
      } catch (error) {
        return pendingResult(
          plan,
          `Approval elicitation failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      if (!decision.approved) {
        return pendingResult(plan, decision.reason);
      }

      if (!await ctx.db.approveGenerationPlan(plan.id, plan.requestHash, ctx.approvalContext)) {
        return pendingResult(
          plan,
          "Approval could not be recorded because the plan expired, changed, or was no longer prepared.",
        );
      }
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            planId: plan.id,
            plan,
            status: "approved",
            approved: true,
            message: "No provider task was created. Host approval was recorded; submit this planId before it expires.",
          }, null, 2),
        }],
      };
    } catch (error) {
      return ctx.formatError("prepare_media_generation", error, {
        items: "Required: one to six objects with a registered generation tool and its args object",
        maxConcurrency: "Optional: concurrent task creates from 1 to 4",
        expiresInSeconds: "Optional: plan lifetime from 60 to 3600 seconds",
      });
    }
  },
};

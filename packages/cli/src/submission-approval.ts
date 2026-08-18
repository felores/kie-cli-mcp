import type { TaskDatabase } from "@felores/kie-ai-core/database";

export async function approvePlanForSubmission(
  db: Pick<TaskDatabase, "getGenerationPlan" | "approveGenerationPlan">,
  args: {
  planId?: unknown;
  approve?: unknown;
},
): Promise<void> {
  if (typeof args.planId !== "string" || args.approve !== args.planId) {
    throw new Error("Submitting a media plan requires --approve <planId> matching --planId.");
  }
  const stored = await db.getGenerationPlan(args.planId);
  if (!stored || !await db.approveGenerationPlan(args.planId, stored.requestHash, "cli")) {
    throw new Error("Plan could not be approved because it was not prepared, has expired, changed, or was already submitted.");
  }
}

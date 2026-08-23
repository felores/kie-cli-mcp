import type {
  PlanApprovalDecision,
  PreparedGenerationPlan,
} from "@felores/kie-ai-core";
import type { Server } from "@modelcontextprotocol/server";

function priceSummary(plan: PreparedGenerationPlan): string {
  return plan.total.status === "exact"
    ? `${plan.total.credits} credits total (verified exact quote)`
    : "total price unknown because one or more request dimensions lack a verified formula";
}

export function formatPlanApprovalMessage(
  plan: PreparedGenerationPlan,
): string {
  const items = plan.items
    .map((item) => {
      const price =
        item.price.status === "exact"
          ? `${item.price.credits} credits`
          : "price unknown";
      return [
        `${item.index + 1}. ${item.tool}: ${item.model}, ${item.mode}, ${item.outputCount} output(s), ${price}`,
        `Resolved settings: ${JSON.stringify(item.effectiveSettings)}`,
      ].join("\n");
    })
    .join("\n");
  return [
    `Approve media generation plan ${plan.id}?`,
    `Expires: ${plan.expiresAt}. Max concurrent creates: ${plan.maxConcurrency}.`,
    `Price: ${priceSummary(plan)}.`,
    items,
    "No provider task has been created. Confirming will record approval only; submission is a separate call.",
  ].join("\n");
}

export async function requestMcpPlanApproval(
  server: Pick<Server, "getClientCapabilities" | "elicitInput">,
  plan: PreparedGenerationPlan,
): Promise<PlanApprovalDecision> {
  // MCP clients before form capabilities were introduced advertise elicitation
  // as an empty object. The SDK keeps that representation compatible with forms.
  if (!server.getClientCapabilities()?.elicitation) {
    return {
      approved: false,
      reason:
        "MCP client does not support form elicitation, so this plan remains unapproved.",
    };
  }
  const response = await server.elicitInput({
    mode: "form",
    message: formatPlanApprovalMessage(plan),
    requestedSchema: {
      type: "object",
      properties: {
        confirm: {
          type: "boolean",
          title: "Approve this media generation plan",
          default: false,
        },
      },
      required: ["confirm"],
    },
  });
  if (response.action === "accept" && response.content?.confirm === true) {
    return { approved: true, reason: "Host confirmed the plan." };
  }
  return {
    approved: false,
    reason:
      response.action === "accept"
        ? "Host accepted the form without confirming the plan."
        : response.action === "cancel"
          ? "Host cancelled the approval request."
          : "Host declined the approval request.",
  };
}

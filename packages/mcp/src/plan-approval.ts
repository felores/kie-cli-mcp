import type {
  PlanApprovalDecision,
  PreparedGenerationPlan,
} from "@felores/kie-ai-core";
import type { Server, ServerContext } from "@modelcontextprotocol/server";
import {
  acceptedContent,
  type ElicitRequestFormParams,
  inputRequired,
} from "@modelcontextprotocol/server";

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

/** JSON Schema for the approval form (shared by legacy and MRTR paths). */
export const APPROVAL_FORM_SCHEMA: ElicitRequestFormParams["requestedSchema"] =
  {
    type: "object",
    properties: {
      confirm: {
        type: "boolean",
        title: "Approve this media generation plan",
        default: false,
      },
    },
    required: ["confirm"],
  };

const MODERN_PROTOCOL_SINCE = "2026-07-28";

function isModernEra(
  server: Pick<Server, "getNegotiatedProtocolVersion">,
): boolean {
  const negotiated = server.getNegotiatedProtocolVersion();
  return negotiated !== undefined && negotiated >= MODERN_PROTOCOL_SINCE;
}

/**
 * Requests host approval for a plan. On legacy (2025-era) connections this
 * pushes a form elicitation request to the client (SDK v1 semantics). On
 * 2026-07-28-era connections approval travels through the multi-round-trip
 * seam: the handler reads the retried decision from
 * `serverCtx.mcpReq.inputResponses` when present, and otherwise marks the
 * decision `inputRequired` so the caller (the prepared-plan tool) can produce
 * an `input_required` result the adapter converts into an MRTR return.
 */
export async function requestMcpPlanApproval(
  server: Pick<
    Server,
    "getClientCapabilities" | "elicitInput" | "getNegotiatedProtocolVersion"
  >,
  plan: PreparedGenerationPlan,
  serverCtx?: ServerContext,
): Promise<PlanApprovalDecision> {
  if (isModernEra(server)) {
    const responses = serverCtx?.mcpReq?.inputResponses;
    if (responses && "confirm" in responses) {
      const accepted = acceptedContent<{ confirm: boolean }>(
        responses,
        "confirm",
      );
      return accepted
        ? {
            approved: accepted.confirm === true,
            reason: "Host confirmed the plan.",
          }
        : {
            approved: false,
            reason: "Host declined the approval request.",
          };
    }
    // First round of the modern flow: no decision travelled yet.
    return {
      approved: false,
      reason: "Host approval required for media generation plan.",
      inputRequired: true,
    };
  }

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
    requestedSchema: APPROVAL_FORM_SCHEMA,
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

/** Builds the input-required return for the approval round trip. */
export function approvalInputRequired(plan: PreparedGenerationPlan) {
  return inputRequired({
    inputRequests: {
      confirm: inputRequired.elicit({
        message: formatPlanApprovalMessage(plan),
        requestedSchema: APPROVAL_FORM_SCHEMA,
      }),
    },
  });
}

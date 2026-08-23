import { describe, expect, jest, test } from "@jest/globals";
import { approvePlanForSubmission } from "../submission-approval.js";

describe("CLI media-plan approval", () => {
  test("requires --approve to match the plan and atomically transitions it", async () => {
    const getGenerationPlan = jest.fn(async () => ({
      plan: {} as never,
      status: "prepared",
      requestHash: "hash",
    }));
    const approveGenerationPlan = jest.fn(async () => true);
    const db = { getGenerationPlan, approveGenerationPlan };

    await expect(
      approvePlanForSubmission(db, { planId: "plan-1" }),
    ).rejects.toThrow("--approve <planId>");
    await expect(
      approvePlanForSubmission(db, { planId: "plan-1", approve: "plan-2" }),
    ).rejects.toThrow("matching --planId");
    await approvePlanForSubmission(db, { planId: "plan-1", approve: "plan-1" });
    expect(approveGenerationPlan).toHaveBeenCalledWith("plan-1", "hash", "cli");

    approveGenerationPlan.mockResolvedValueOnce(false);
    await expect(
      approvePlanForSubmission(db, { planId: "plan-1", approve: "plan-1" }),
    ).rejects.toThrow("could not be approved");
  });
});

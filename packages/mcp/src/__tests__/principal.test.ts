import { describe, expect, test } from "@jest/globals";
import {
  isUsablePrincipal,
  principalApprovalId,
  STDIO_PRINCIPAL,
} from "../principal.js";

describe("caller principal", () => {
  test("derives a stable approval owner per principal", () => {
    expect(principalApprovalId("alpha")).toBe(principalApprovalId("alpha"));
    expect(principalApprovalId("alpha")).not.toBe(principalApprovalId("beta"));
  });

  test("distinguishes the stdio principal from session principals", () => {
    expect(principalApprovalId(STDIO_PRINCIPAL)).not.toBe(
      principalApprovalId("some-session"),
    );
  });

  test("is deterministic for the same transport identity", () => {
    const session = "0a9f8e7d-6c5b-4a3b-9f8e-7d6c5b4a3b21";
    expect(principalApprovalId(session)).toBe(principalApprovalId(session));
  });

  test("validates principal shape", () => {
    expect(isUsablePrincipal("")).toBe(false);
    expect(isUsablePrincipal("x".repeat(513))).toBe(false);
    expect(isUsablePrincipal("alpha")).toBe(true);
    expect(isUsablePrincipal("x".repeat(512))).toBe(true);
  });
});

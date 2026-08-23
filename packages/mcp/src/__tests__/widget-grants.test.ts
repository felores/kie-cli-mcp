import { describe, expect, test } from "@jest/globals";
import { WidgetGrantService } from "../widget-grants.js";

describe("WidgetGrantService", () => {
  test("mints and validates a grant for its owner only", () => {
    const service = new WidgetGrantService();
    const grant = service.createGrant("owner-a");
    expect(service.validateGrant("owner-a", grant)).toBe(true);
    expect(service.validateGrant("owner-b", grant)).toBe(false);
  });

  test("rejects unknown grants and accepts in-limit repeated use", () => {
    const service = new WidgetGrantService();
    expect(service.validateGrant("owner-a", "not-a-grant")).toBe(false);
    const grant = service.createGrant("owner-a");
    expect(service.validateGrant("owner-a", grant)).toBe(true);
    expect(service.validateGrant("owner-a", grant)).toBe(true);
    expect(service.validateGrant("owner-a", "not-a-grant")).toBe(false);
  });

  test("expires grants after the ten-minute TTL", () => {
    let now = 1_000_000_000;
    const service = new WidgetGrantService(() => now);
    const grant = service.createGrant("owner-a");
    expect(service.validateGrant("owner-a", grant)).toBe(true);
    now += 10 * 60 * 1000;
    expect(service.validateGrant("owner-a", grant)).toBe(false);
  });

  test("limits each grant to four uses", () => {
    const service = new WidgetGrantService();
    const grant = service.createGrant("owner-a");
    for (let index = 0; index < 4; index += 1) {
      expect(service.validateGrant("owner-a", grant)).toBe(true);
    }
    expect(service.validateGrant("owner-a", grant)).toBe(false);
  });

  test("caps active grants per owner and evicts the oldest", () => {
    const service = new WidgetGrantService();
    const minted: string[] = [];
    for (let index = 0; index < 17; index += 1) {
      minted.push(service.createGrant("owner-a"));
    }
    expect(service.validateGrant("owner-a", minted[0])).toBe(false);
    expect(service.validateGrant("owner-a", minted[15])).toBe(true);
    expect(service.validateGrant("owner-a", minted[16])).toBe(true);
  });

  test("isolates owners with independent caps", () => {
    const service = new WidgetGrantService();
    for (let index = 0; index < 17; index += 1) {
      service.createGrant("owner-a");
    }
    const grant = service.createGrant("owner-b");
    expect(service.validateGrant("owner-b", grant)).toBe(true);
  });
});

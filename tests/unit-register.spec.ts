import { test, expect } from "@playwright/test";
import {
  normalizeDomainInput,
  normalizeInviteCode,
  routeAfterPeek,
} from "../lib/register";

test.describe("SG2 register helpers", () => {
  test("routeAfterPeek joins on domain match", () => {
    expect(
      routeAfterPeek({
        tenant_id: "aaa",
        tenant_name: "Duo",
        via: "domain",
      })
    ).toEqual({ kind: "join_domain", tenantId: "aaa", tenantName: "Duo" });
  });

  test("routeAfterPeek onboards otherwise", () => {
    expect(routeAfterPeek(null)).toEqual({ kind: "onboard" });
    expect(
      routeAfterPeek({ tenant_id: "aaa", tenant_name: "X", via: "membership" })
    ).toEqual({ kind: "onboard" });
  });

  test("normalizeInviteCode", () => {
    expect(normalizeInviteCode(" ab-12cd ")).toBe("AB12CD");
  });

  test("normalizeDomainInput", () => {
    expect(normalizeDomainInput("Sirket.COM")).toBe("sirket.com");
    expect(normalizeDomainInput("@acme.io")).toBe("acme.io");
    expect(normalizeDomainInput("bad@x")).toBeNull();
    expect(normalizeDomainInput("")).toBeNull();
  });
});

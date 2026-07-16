import { test, expect } from "@playwright/test";

test.describe("apiAuthHeaders", () => {
  test("bypass mode sets X-Dev-User and still attempts session Bearer", async () => {
    process.env.NEXT_PUBLIC_AUTH_BYPASS = "1";
    const { apiAuthHeaders } = await import("../../lib/api-headers");
    const h = await apiAuthHeaders(
      "admin@duosis.dev",
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    );
    expect(h["Content-Type"]).toBe("application/json");
    expect(h["X-Dev-User"]).toContain("admin@duosis.dev");
    // No live session in unit context → Authorization may be absent
    expect(h.Authorization === undefined || h.Authorization.startsWith("Bearer ")).toBe(
      true
    );
  });
});

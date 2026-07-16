import { test, expect } from "@playwright/test";
import { isPermission, PERMISSIONS } from "../lib/permissions";

test.describe("permissions catalog", () => {
  test("platform.manage_tenants is registered", () => {
    expect(isPermission("platform.manage_tenants")).toBe(true);
    expect(PERMISSIONS.includes("platform.manage_tenants")).toBe(true);
  });

  test("unknown key rejected", () => {
    expect(isPermission("not.a.perm")).toBe(false);
  });
});

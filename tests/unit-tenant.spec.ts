import { test, expect } from "@playwright/test";
import {
  emailDomain,
  resolveTenantId,
  DUOSIS_TENANT_ID,
  OTHER_TENANT_ID,
  type TenantRecord,
} from "../lib/tenant";

const tenants: TenantRecord[] = [
  {
    id: DUOSIS_TENANT_ID,
    name: "DuoSis",
    azure_tenant_id: "azure-duo",
    email_domain: "duosis.dev",
  },
  {
    id: OTHER_TENANT_ID,
    name: "Other Corp",
    azure_tenant_id: "azure-other",
    email_domain: "other.com",
  },
];

test.describe("tenant resolution", () => {
  test("emailDomain extracts lowercased domain", () => {
    expect(emailDomain("Admin@DuoSis.DEV")).toBe("duosis.dev");
    expect(emailDomain("nodomain")).toBeNull();
  });

  test("Azure tenant id wins over email domain", () => {
    expect(
      resolveTenantId(tenants, {
        azureTenantId: "azure-other",
        email: "x@duosis.dev",
      })
    ).toBe(OTHER_TENANT_ID);
  });

  test("falls back to email domain", () => {
    expect(resolveTenantId(tenants, { email: "admin@duosis.dev" })).toBe(
      DUOSIS_TENANT_ID
    );
  });

  test("rejects unknown domain", () => {
    expect(resolveTenantId(tenants, { email: "a@unknown.test" })).toBeNull();
  });
});

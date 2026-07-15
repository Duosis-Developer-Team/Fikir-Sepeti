import { test, expect } from "@playwright/test";
import {
  emailDomain,
  resolveTenantId,
  tenantDomains,
  DUOSIS_TENANT_ID,
  OTHER_TENANT_ID,
  type TenantRecord,
} from "../lib/tenant";
import { azureTenantIdFromUser } from "../lib/azure-claims";
import type { User } from "@supabase/supabase-js";

const tenants: TenantRecord[] = [
  {
    id: DUOSIS_TENANT_ID,
    name: "DuoSis",
    azure_tenant_id: "azure-duo",
    email_domain: "duosis.dev",
    domains: ["duosis.com"],
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

  test("tenantDomains merges legacy + extra", () => {
    expect(tenantDomains(tenants[0]).sort()).toEqual(["duosis.com", "duosis.dev"]);
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

  test("matches extra domain duosis.com to DuoSis", () => {
    expect(resolveTenantId(tenants, { email: "user@duosis.com" })).toBe(
      DUOSIS_TENANT_ID
    );
  });

  test("rejects unknown domain", () => {
    expect(resolveTenantId(tenants, { email: "a@unknown.test" })).toBeNull();
  });
});

test.describe("azureTenantIdFromUser", () => {
  test("reads tid from custom_claims", () => {
    const user = {
      id: "1",
      email: "a@duosis.com",
      app_metadata: {},
      user_metadata: { custom_claims: { tid: "azure-duo" } },
      aud: "authenticated",
      created_at: "",
    } as unknown as User;
    expect(azureTenantIdFromUser(user)).toBe("azure-duo");
  });

  test("returns null when missing", () => {
    const user = {
      id: "1",
      email: "a@duosis.com",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: "",
    } as unknown as User;
    expect(azureTenantIdFromUser(user)).toBeNull();
  });
});

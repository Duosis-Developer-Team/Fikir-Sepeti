/** Tenant resolution — pure logic (S1). Azure tenant id wins, then email domain. */

export type TenantRecord = {
  id: string;
  name: string;
  azure_tenant_id: string | null;
  email_domain: string | null;
};

export type TenantClaims = {
  azureTenantId?: string | null;
  email?: string | null;
};

export function emailDomain(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at < 0 || at === email.length - 1) return null;
  return email.slice(at + 1).toLowerCase();
}

/**
 * Resolve tenant from claims against a tenant list.
 * Returns null when no match (caller must reject).
 */
export function resolveTenantId(
  tenants: TenantRecord[],
  claims: TenantClaims
): string | null {
  const azure = claims.azureTenantId?.trim();
  if (azure) {
    const byAzure = tenants.find((t) => t.azure_tenant_id === azure);
    if (byAzure) return byAzure.id;
  }

  const domain = emailDomain(claims.email);
  if (domain) {
    const byDomain = tenants.find(
      (t) => t.email_domain && t.email_domain.toLowerCase() === domain
    );
    if (byDomain) return byDomain.id;
  }

  return null;
}

/** Seed / bypass default DuoSis tenant id (fixed UUID). */
export const DUOSIS_TENANT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const OTHER_TENANT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

/** Tenant resolution — pure logic (S1 + hotfix multi-domain). Azure tenant id wins, then email domain. */

export type TenantRecord = {
  id: string;
  name: string;
  azure_tenant_id: string | null;
  /** Legacy single domain column — still honored. */
  email_domain: string | null;
  /** Extra domains from tenant_domains (optional in-memory). */
  domains?: string[];
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

/** Collect all domains for a tenant record (deduped, lowercased). */
export function tenantDomains(t: TenantRecord): string[] {
  const set = new Set<string>();
  if (t.email_domain) set.add(t.email_domain.toLowerCase());
  for (const d of t.domains ?? []) {
    if (d) set.add(d.toLowerCase());
  }
  return [...set];
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
    const byDomain = tenants.find((t) => tenantDomains(t).includes(domain));
    if (byDomain) return byDomain.id;
  }

  return null;
}

/** Seed / bypass default DuoSis tenant id (fixed UUID). */
export const DUOSIS_TENANT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const OTHER_TENANT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

/** Pure helpers for SG2 registration routing. */

export type RegisterRoute =
  | { kind: "join_domain"; tenantId: string; tenantName: string }
  | { kind: "onboard" };

export function routeAfterPeek(peek: {
  tenant_id: string | null;
  tenant_name: string | null;
  via: string | null;
} | null): RegisterRoute {
  if (peek?.tenant_id && peek.via === "domain") {
    return {
      kind: "join_domain",
      tenantId: peek.tenant_id,
      tenantName: peek.tenant_name ?? "Çalışma alanı",
    };
  }
  return { kind: "onboard" };
}

export function normalizeInviteCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function normalizeDomainInput(raw: string): string | null {
  const d = raw.trim().toLowerCase().replace(/^@/, "");
  if (!d) return null;
  if (d.includes("@") || d.includes(" ")) return null;
  if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(d)) return null;
  return d;
}

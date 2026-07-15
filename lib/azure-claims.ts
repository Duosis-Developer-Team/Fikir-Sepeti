import type { User } from "@supabase/supabase-js";

/** Extract Azure Entra tenant id (tid) from Supabase user metadata when present. */
export function azureTenantIdFromUser(user: User | null | undefined): string | null {
  if (!user) return null;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const app = (user.app_metadata ?? {}) as Record<string, unknown>;
  const custom = meta.custom_claims as Record<string, unknown> | undefined;
  const identities = user.identities ?? [];
  const azureIdentity = identities.find((i) => i.provider === "azure");
  const idData = (azureIdentity?.identity_data ?? {}) as Record<string, unknown>;

  const candidates = [
    custom?.tid,
    meta.tid,
    app.tid,
    idData.tid,
    (idData as { tenant_id?: unknown }).tenant_id,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

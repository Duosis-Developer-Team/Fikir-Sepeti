import type { SupabaseClient } from "@supabase/supabase-js";
import { checkContent, type CheckResult, type ContentRule } from "./moderation";

export async function loadTenantRules(
  sb: SupabaseClient,
  tenantId: string
): Promise<ContentRule[]> {
  const { data } = await sb
    .from("content_rules")
    .select("id, pattern, kind, action, enabled")
    .eq("tenant_id", tenantId)
    .eq("enabled", true);
  return (data as ContentRule[]) ?? [];
}

export async function evaluateText(
  sb: SupabaseClient,
  tenantId: string,
  text: string
): Promise<CheckResult> {
  const rules = await loadTenantRules(sb, tenantId);
  return checkContent(text, rules);
}

export async function writeAudit(
  sb: SupabaseClient,
  input: {
    tenant_id: string;
    actor: string;
    action: string;
    entity_type?: string | null;
    entity_id?: string | null;
    meta?: Record<string, unknown>;
  }
) {
  await sb.from("audit_log").insert({
    tenant_id: input.tenant_id,
    actor: input.actor,
    action: input.action,
    entity_type: input.entity_type ?? null,
    entity_id: input.entity_id ?? null,
    meta: input.meta ?? {},
  });
}

export async function createFlags(
  sb: SupabaseClient,
  input: {
    tenant_id: string;
    entity_type: "idea" | "pool" | "feedback";
    entity_id: string;
    created_by: string;
    hits: { ruleId: string; matched: string }[];
  }
) {
  if (!input.hits.length) return;
  await sb.from("content_flags").insert(
    input.hits.map((h) => ({
      tenant_id: input.tenant_id,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      rule_id: h.ruleId,
      matched_text: h.matched,
      status: "pending",
      created_by: input.created_by,
    }))
  );
}

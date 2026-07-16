"use client";

import { supabase } from "./supabase";
import type { BasketType, PoolIdea } from "./types";

function authHeaders(email: string, tenantId: string): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.NEXT_PUBLIC_AUTH_BYPASS === "1") {
    headers["X-Dev-User"] = JSON.stringify({ email, tenantId });
  }
  return headers;
}

export async function listPoolIdeas(tenantId: string): Promise<PoolIdea[]> {
  const { data } = await supabase
    .from("idea_pool")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  return (data as PoolIdea[]) ?? [];
}

export async function createPoolIdea(input: {
  text: string;
  brief?: string | null;
  category?: string | null;
  track_hint?: "hackathon" | "etkinlik" | null;
  poll_closes_at?: string | null;
  status?: PoolIdea["status"];
  created_by: string;
  tenant_id: string;
  acknowledge?: boolean;
}): Promise<PoolIdea | null> {
  const res = await fetch("/api/pool", {
    method: "POST",
    headers: authHeaders(input.created_by, input.tenant_id),
    body: JSON.stringify({
      text: input.text,
      brief: input.brief,
      category: input.category,
      track_hint: input.track_hint,
      poll_closes_at: input.poll_closes_at,
      status: input.status,
      acknowledge: input.acknowledge,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    idea?: PoolIdea;
    error?: string;
    message?: string;
  };
  if (res.status === 422) {
    if (typeof window !== "undefined") {
      window.alert("Bu metin kurallara takıldı ve gönderilemiyor.");
    }
    return null;
  }
  if (res.status === 409 && json.error === "warn") {
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        json.message ||
          "Metinde uyarılan kelimeler var. Göndermek istediğine emin misin?"
      );
      if (!ok) return null;
      return createPoolIdea({ ...input, acknowledge: true });
    }
    return null;
  }
  if (!res.ok) return null;
  return json.idea ?? null;
}

export async function votePoolIdea(input: {
  pool_idea_id: string;
  voter: string;
  tenant_id: string;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/pool/vote", {
    method: "POST",
    headers: authHeaders(input.voter, input.tenant_id),
    body: JSON.stringify({ pool_idea_id: input.pool_idea_id }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { ok: false, error: (err as { error?: string }).error };
  }
  return { ok: true };
}

export async function promotePoolIdeas(input: {
  pool_idea_ids: string[];
  type: BasketType;
  title: string;
  created_by: string;
  tenant_id: string;
}): Promise<{ basketId: string } | null> {
  const res = await fetch("/api/pool/promote", {
    method: "POST",
    headers: authHeaders(input.created_by, input.tenant_id),
    body: JSON.stringify({
      pool_idea_ids: input.pool_idea_ids,
      type: input.type,
      title: input.title,
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { basketId: string };
  return json.basketId ? { basketId: json.basketId } : null;
}

export async function returnIdeaToPool(input: {
  idea_id: string;
  basket_id: string;
  created_by: string;
  tenant_id: string;
}): Promise<PoolIdea | null> {
  const res = await fetch("/api/pool/return", {
    method: "POST",
    headers: authHeaders(input.created_by, input.tenant_id),
    body: JSON.stringify({
      idea_id: input.idea_id,
      basket_id: input.basket_id,
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { idea: PoolIdea };
  return json.idea ?? null;
}

export async function markPoolWinner(input: {
  pool_idea_id: string;
  winner_label: string;
  tenant_id: string;
  actor: string;
}): Promise<boolean> {
  const res = await fetch("/api/pool/mark-winner", {
    method: "POST",
    headers: authHeaders(input.actor, input.tenant_id),
    body: JSON.stringify({
      pool_idea_id: input.pool_idea_id,
      winner_label: input.winner_label,
    }),
  });
  return res.ok;
}

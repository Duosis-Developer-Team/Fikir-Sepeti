"use client";

function authHeaders(email: string, tenantId: string): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.NEXT_PUBLIC_AUTH_BYPASS === "1") {
    headers["X-Dev-User"] = JSON.stringify({ email, tenantId });
  }
  return headers;
}

export type ArchiveBasket = {
  id: string;
  title: string;
  type: string;
  status: string;
  created_by: string | null;
  created_at: string;
  winner_idea_id: string | null;
};

export async function listArchive(input: {
  email: string;
  tenantId: string;
  type?: string;
  q?: string;
}): Promise<{ baskets: ArchiveBasket[]; viewAll: boolean }> {
  const params = new URLSearchParams();
  if (input.type) params.set("type", input.type);
  if (input.q) params.set("q", input.q);
  const res = await fetch(`/api/archive?${params}`, {
    headers: authHeaders(input.email, input.tenantId),
  });
  if (!res.ok) return { baskets: [], viewAll: false };
  return res.json();
}

export async function fetchArchiveResult(input: {
  basketId: string;
  email: string;
  tenantId: string;
}): Promise<Record<string, unknown> | null> {
  const res = await fetch(`/api/archive/${input.basketId}`, {
    headers: authHeaders(input.email, input.tenantId),
  });
  if (!res.ok) return null;
  return res.json();
}

export function archiveCsvUrl(basketId: string): string {
  return `/api/archive/${basketId}/csv`;
}

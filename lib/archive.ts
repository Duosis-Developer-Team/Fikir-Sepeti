"use client";

import { apiAuthHeaders } from "./api-headers";

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
    headers: await apiAuthHeaders(input.email, input.tenantId),
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
    headers: await apiAuthHeaders(input.email, input.tenantId),
  });
  if (!res.ok) return null;
  return res.json();
}

export function archiveCsvUrl(basketId: string): string {
  return `/api/archive/${basketId}/csv`;
}

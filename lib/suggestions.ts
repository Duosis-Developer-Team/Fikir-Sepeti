"use client";

import { apiAuthHeaders } from "./api-headers";
import type { Suggestion } from "./types";

export async function listSuggestions(
  email: string,
  tenantId: string
): Promise<{ suggestions: Suggestion[]; myVotes: string[] }> {
  const res = await fetch("/api/suggestions", {
    headers: await apiAuthHeaders(email, tenantId),
  });
  if (!res.ok) return { suggestions: [], myVotes: [] };
  const json = (await res.json()) as { suggestions?: Suggestion[]; myVotes?: string[] };
  return { suggestions: json.suggestions ?? [], myVotes: json.myVotes ?? [] };
}

export async function createSuggestion(input: {
  text: string;
  email: string;
  tenantId: string;
}): Promise<{ ok: boolean; suggestion?: Suggestion; error?: string }> {
  const res = await fetch("/api/suggestions", {
    method: "POST",
    headers: await apiAuthHeaders(input.email, input.tenantId),
    body: JSON.stringify({ text: input.text }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    suggestion?: Suggestion;
    error?: string;
  };
  if (!res.ok) return { ok: false, error: json.error };
  return { ok: true, suggestion: json.suggestion };
}

export async function voteSuggestion(input: {
  suggestionId: string;
  email: string;
  tenantId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/suggestions/vote", {
    method: "POST",
    headers: await apiAuthHeaders(input.email, input.tenantId),
    body: JSON.stringify({ suggestion_id: input.suggestionId }),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) return { ok: false, error: json.error };
  return { ok: true };
}

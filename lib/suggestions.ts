"use client";

import { apiAuthHeaders } from "./api-headers";
import type { Suggestion } from "./types";

export async function listSuggestions(email: string, tenantId: string): Promise<Suggestion[]> {
  const res = await fetch("/api/suggestions", {
    headers: await apiAuthHeaders(email, tenantId),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { suggestions?: Suggestion[] };
  return json.suggestions ?? [];
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

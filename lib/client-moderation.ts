"use client";

import { apiAuthHeaders } from "./api-headers";

export type ModerationWarn = {
  error: "warn";
  message: string;
  hits: { ruleId: string; pattern: string; matched: string }[];
};

export async function submitModeratedIdea(input: {
  email: string;
  tenantId: string;
  basket_id: string;
  text: string;
  tag?: string | null;
  acknowledge?: boolean;
}): Promise<
  | { ok: true; idea: unknown }
  | { ok: false; status: number; body: Record<string, unknown> }
> {
  const res = await fetch("/api/content/ideas", {
    method: "POST",
    headers: await apiAuthHeaders(input.email, input.tenantId),
    body: JSON.stringify({
      basket_id: input.basket_id,
      text: input.text,
      tag: input.tag,
      acknowledge: input.acknowledge,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, status: res.status, body };
  return { ok: true, idea: body.idea };
}

export async function submitModeratedFeedback(input: {
  email: string;
  tenantId: string;
  basket_id: string;
  text: string;
  team_id?: string | null;
  idea_id?: string | null;
  author_name?: string | null;
  acknowledge?: boolean;
}): Promise<
  | { ok: true }
  | { ok: false; status: number; body: Record<string, unknown> }
> {
  const res = await fetch("/api/content/feedback", {
    method: "POST",
    headers: await apiAuthHeaders(input.email, input.tenantId),
    body: JSON.stringify({
      basket_id: input.basket_id,
      text: input.text,
      team_id: input.team_id,
      idea_id: input.idea_id,
      author_name: input.author_name,
      acknowledge: input.acknowledge,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, status: res.status, body };
  return { ok: true };
}

/** Confirm dialog helper for warn flow. Returns true if content was submitted. */
export async function confirmWarnIfNeeded(
  result: { ok: false; status: number; body: Record<string, unknown> },
  retry: (acknowledge: true) => Promise<{ ok: boolean }>
): Promise<boolean> {
  if (result.status === 422) {
    window.alert("Bu metin kurallara takıldı ve gönderilemiyor.");
    return false;
  }
  if (result.status === 409 && result.body.error === "warn") {
    const msg =
      (result.body.message as string) ||
      "Metinde uyarılan kelimeler var. Göndermek istediğine emin misin?";
    if (!window.confirm(msg)) return false;
    const again = await retry(true);
    return again.ok;
  }
  return false;
}

/** Submit idea with warn/block UX. */
export async function addIdeaModerated(input: {
  email: string;
  tenantId: string;
  basket_id: string;
  text: string;
  tag?: string | null;
}): Promise<unknown | null> {
  const first = await submitModeratedIdea(input);
  if (first.ok) return first.idea;
  let submitted: unknown | null = null;
  const ok = await confirmWarnIfNeeded(first, async (acknowledge) => {
    const again = await submitModeratedIdea({ ...input, acknowledge });
    if (again.ok) submitted = again.idea;
    return { ok: again.ok };
  });
  return ok ? submitted : null;
}

/** Submit feedback with warn/block UX. */
export async function addFeedbackModerated(input: {
  email: string;
  tenantId: string;
  basket_id: string;
  text: string;
  team_id?: string | null;
  idea_id?: string | null;
  author_name?: string | null;
}): Promise<boolean> {
  const first = await submitModeratedFeedback(input);
  if (first.ok) return true;
  return confirmWarnIfNeeded(first, async (acknowledge) => {
    const again = await submitModeratedFeedback({ ...input, acknowledge });
    return { ok: again.ok };
  });
}

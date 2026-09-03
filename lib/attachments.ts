"use client";

import type { IdeaAttachment } from "./types";

/** Önizleme linki — img/PDF gibi tarayıcının açabildiği tipler sekmede direkt açılır. */
export function ideaAttachmentUrl(ideaId: string): string {
  return `/api/ideas/${ideaId}/attachment`;
}

/** İndirme linki — Content-Disposition: attachment döner, tarayıcı sekmede açmak yerine kaydeder. */
export function ideaAttachmentDownloadUrl(ideaId: string): string {
  return `/api/ideas/${ideaId}/attachment?download=1`;
}

export async function getIdeaAttachmentMeta(
  ideaId: string
): Promise<Pick<IdeaAttachment, "filename" | "mime_type" | "size_bytes"> | null> {
  const res = await fetch(`/api/ideas/${ideaId}/attachment?meta=1`, { credentials: "same-origin" });
  if (!res.ok) return null;
  return res.json();
}

/** Dosyayı doğrudan gönderir — Content-Type kasıtlı olarak elle set edilmiyor,
 * tarayıcı multipart sınırını (boundary) kendisi ekliyor. */
export async function uploadIdeaAttachment(
  ideaId: string,
  file: File
): Promise<{ ok: boolean; error?: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`/api/ideas/${ideaId}/attachment`, {
    method: "POST",
    body: form,
    credentials: "same-origin",
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: json.error };
  }
  return { ok: true };
}

export async function deleteIdeaAttachment(ideaId: string): Promise<boolean> {
  const res = await fetch(`/api/ideas/${ideaId}/attachment`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  return res.ok;
}

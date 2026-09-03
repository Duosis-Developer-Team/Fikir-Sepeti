"use client";

import { useEffect, useState } from "react";
import { getIdeaAttachmentMeta, ideaAttachmentDownloadUrl, ideaAttachmentUrl } from "@/lib/attachments";
import { GOLD, GOLD_SOFT } from "./contract";

/** Bir fikre eklenmiş dosyanın "aç" ve "indir" linkleri — varsa gösterir, yoksa hiçbir şey render etmez. */
export function IdeaAttachment({ ideaId }: { ideaId: string }) {
  const [meta, setMeta] = useState<{ filename: string; mime_type: string; size_bytes: number } | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setMeta(undefined);
    getIdeaAttachmentMeta(ideaId).then((m) => {
      if (!cancelled) setMeta(m);
    });
    return () => {
      cancelled = true;
    };
  }, [ideaId]);

  if (!meta) return null;
  const kb = Math.max(1, Math.round(meta.size_bytes / 1024));
  return (
    <div className="mt-3 inline-flex items-center gap-2" data-testid={`idea-attachment-${ideaId}`}>
      <a
        href={ideaAttachmentUrl(ideaId)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[0.88rem] font-semibold transition hover:opacity-90"
        style={{ background: "rgba(231,169,63,0.12)", border: `1px solid ${GOLD}`, color: GOLD_SOFT }}
      >
        📎 {meta.filename} ({kb} KB) — Aç →
      </a>
      <a
        href={ideaAttachmentDownloadUrl(ideaId)}
        download={meta.filename}
        aria-label={`${meta.filename} dosyasını indir`}
        title="İndir"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full transition hover:opacity-90"
        style={{ background: "rgba(231,169,63,0.12)", border: `1px solid ${GOLD}`, color: GOLD_SOFT }}
      >
        ⬇
      </a>
    </div>
  );
}

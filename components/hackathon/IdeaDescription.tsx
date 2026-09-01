"use client";

import { useState } from "react";
import { GOLD_SOFT, dim } from "./contract";

const CLAMP_CHARS = 160;

/**
 * Fikir açıklaması — uzunsa 3 satırda kesilir (tek kelimelik uzun bir dizi
 * de dahil, kart dışına taşmaz), "devamını oku" tam metni bir pencerede açar.
 */
export function IdeaDescription({ text }: { text: string | null | undefined }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;

  return (
    <>
      <p
        className="mt-2 text-[0.9rem] leading-relaxed"
        style={{
          color: dim(0.55),
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          overflowWrap: "anywhere",
        }}
      >
        {text}
      </p>
      {text.length > CLAMP_CHARS && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-1 text-[0.82rem] font-semibold hover:underline"
          style={{ color: GOLD_SOFT }}
        >
          devamını oku →
        </button>
      )}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-[560px] overflow-y-auto rounded-2xl p-6"
            style={{ background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.1)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p
              className="whitespace-pre-wrap text-[1rem] leading-relaxed"
              style={{ color: "var(--text)", overflowWrap: "anywhere" }}
            >
              {text}
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-5 rounded-full px-5 py-2 text-[0.88rem] font-semibold"
              style={{ background: "var(--surface-2)", color: "var(--text-2)" }}
            >
              Kapat
            </button>
          </div>
        </div>
      )}
    </>
  );
}

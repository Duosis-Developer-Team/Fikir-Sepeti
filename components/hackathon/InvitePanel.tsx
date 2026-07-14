"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { GOLD, GOLD_SOFT, dim } from "./contract";

/** Kahoot-vari davet: paylaşılabilir link + QR + kod. Açan herkes iş e-postasıyla lobiye katılır. */
export function InvitePanel({ basketId }: { basketId: string }) {
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const link = `${window.location.origin}/basket/${basketId}`;
    setUrl(link);
    QRCode.toDataURL(link, { margin: 1, width: 320, color: { dark: "#17150F", light: "#FFFFFF" } })
      .then(setQr)
      .catch(() => {});
  }, [basketId]);

  const code = basketId.slice(0, 6).toUpperCase();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard yoksa sessiz geç */
    }
  };

  return (
    <div className="grain relative overflow-hidden rounded-[24px] p-7" style={{ background: "linear-gradient(180deg, var(--sheen), transparent 46%), var(--card)", border: "1px solid rgba(231,169,63,0.28)", boxShadow: "var(--card-shadow), 0 30px 60px -42px rgba(231,169,63,0.3), inset 0 1px 0 var(--edge)" }}>
      <div className="flex items-baseline justify-between">
        <span className="text-[0.72rem] font-semibold uppercase tracking-[0.22em]" style={{ color: GOLD }}>Ekibi davet et</span>
        <span className="tnum text-[0.85rem]" style={{ color: dim(0.5) }}>kod <span className="font-display font-bold" style={{ color: GOLD_SOFT }}>{code}</span></span>
      </div>

      <div className="mt-4 flex items-center gap-4">
        {qr ? <img src={qr} alt="davet QR" className="h-[92px] w-[92px] shrink-0 rounded-xl" style={{ background: "#fff", padding: 6 }} /> : <div className="h-[92px] w-[92px] shrink-0 rounded-xl" style={{ background: "var(--surface-2)" }} />}
        <p className="text-[0.9rem] leading-snug" style={{ color: dim(0.6) }}>
          Linki <b style={{ color: "var(--text)" }}>WhatsApp&apos;a yapıştır</b> ya da QR&apos;ı okut. Açan herkes iş e-postasıyla girip lobiye katılır.
        </p>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.08)" }}>
        <span className="min-w-0 flex-1 truncate text-[0.85rem]" style={{ color: dim(0.65) }}>{url}</span>
        <button
          onClick={copy}
          className="shrink-0 rounded-full px-4 py-1.5 text-[0.82rem] font-semibold transition"
          style={{ background: copied ? "rgba(51,194,147,0.16)" : GOLD, color: copied ? "#6FD9B4" : "#17150F" }}
        >
          {copied ? "Kopyalandı ✓" : "Kopyala"}
        </button>
      </div>
    </div>
  );
}

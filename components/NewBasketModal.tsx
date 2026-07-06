"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { BasketType, ResolveMethod } from "@/lib/types";

const CORAL = "#F2795F";
const GOLD = "#E7A93F";
const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

export function NewBasketModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (input: { title: string; type: BasketType; resolve_method: ResolveMethod }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<BasketType>("social");
  const [method, setMethod] = useState<ResolveMethod>("vote");
  const [busy, setBusy] = useState(false);

  const accent = type === "build" ? GOLD : CORAL;
  const ready = title.trim().length >= 2 && !busy;

  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    await onCreate({ title: title.trim(), type, resolve_method: type === "build" ? "vote" : method });
    setBusy(false);
    setTitle("");
    setType("social");
    setMethod("vote");
    onClose();
  };

  const TypeCard = ({ v, label, desc }: { v: BasketType; label: string; desc: string }) => {
    const on = type === v;
    const c = v === "build" ? GOLD : CORAL;
    return (
      <button
        onClick={() => setType(v)}
        className="rounded-2xl px-[18px] py-4 text-left transition"
        style={{ background: on ? rgba(c, 0.1) : "#242424", border: `1px solid ${on ? c : "rgba(255,255,255,0.08)"}` }}
      >
        <span className="block font-display text-[1.05rem] font-semibold" style={{ color: on ? c : "#EDEDED" }}>{label}</span>
        <span className="mt-0.5 block text-[0.82rem]" style={{ color: "#9A9A9A" }}>{desc}</span>
      </button>
    );
  };

  const MethodBtn = ({ v, label }: { v: ResolveMethod; label: string }) => {
    const on = method === v;
    return (
      <button
        onClick={() => setMethod(v)}
        className="flex-1 rounded-xl py-[11px] text-[0.92rem] font-semibold transition"
        style={{ background: on ? rgba(CORAL, 0.12) : "#242424", border: `1px solid ${on ? CORAL : "rgba(255,255,255,0.08)"}`, color: on ? CORAL : "#9A9A9A" }}
      >
        {label}
      </button>
    );
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40 flex items-end justify-center px-4 pb-4 sm:items-center sm:pb-0"
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-[440px] rounded-[24px] p-7"
            style={{ background: "#1C1C1C", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 40px 100px -40px rgba(0,0,0,0.9)" }}
            initial={{ scale: 0.96, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 16 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-[1.4rem] font-bold" style={{ color: "#EDEDED" }}>Yeni sepet</h2>
            <p className="mt-1 text-[0.9rem]" style={{ color: "#9A9A9A" }}>Ekibe bir karar sor.</p>

            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Ne konuşuyoruz? (ör. akşam nereye gidelim)"
              className="mt-5 w-full rounded-[14px] px-[18px] py-[14px] text-[0.98rem] outline-none"
              style={{ background: "#242424", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEDED" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = rgba(accent, 0.6))}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            />

            <div className="mt-4 grid grid-cols-2 gap-3">
              <TypeCard v="social" label="Sosyal" desc="fikir at, oy ver / kura" />
              <TypeCard v="build" label="Build" desc="iç hackathon akışı" />
            </div>

            <AnimatePresence initial={false}>
              {type === "social" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 flex gap-3">
                    <MethodBtn v="vote" label="Oylama" />
                    <MethodBtn v="raffle" label="Kura" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-7 flex items-center justify-end gap-2">
              <button onClick={onClose} className="rounded-full px-5 py-[11px] text-[0.92rem] font-semibold transition hover:bg-white/5" style={{ color: "#9A9A9A" }}>
                Vazgeç
              </button>
              <button
                onClick={submit}
                disabled={!ready}
                className="rounded-full px-6 py-[11px] text-[0.92rem] font-bold transition hover:-translate-y-px disabled:translate-y-0"
                style={{ background: ready ? accent : "#2A2A2A", color: ready ? "#0F0F0F" : "#6E6E6E" }}
              >
                {busy ? "Oluşturuluyor…" : "Oluştur"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

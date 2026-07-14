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

function TypeCard({
  v,
  label,
  desc,
  selected,
  onSelect,
}: {
  v: BasketType;
  label: string;
  desc: string;
  selected: BasketType;
  onSelect: (v: BasketType) => void;
}) {
  const on = selected === v;
  const c = v === "hackathon" ? GOLD : CORAL;
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(v)}
      className="grain relative overflow-hidden rounded-2xl px-5 py-[18px] text-left transition"
      style={{
        background: on ? `linear-gradient(180deg, ${rgba(c, 0.13)}, transparent 62%), var(--surface-2)` : "var(--surface-2)",
        border: `1px solid ${on ? c : "rgba(var(--border-rgb),0.09)"}`,
        boxShadow: on ? `0 12px 34px -20px ${rgba(c, 0.65)}, inset 0 1px 0 var(--edge)` : "inset 0 1px 0 var(--edge)",
      }}
    >
      <span className="relative flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: on ? c : "rgba(var(--border-rgb),0.28)" }} />
        <span className="font-display text-[1.08rem] font-bold" style={{ color: on ? c : "var(--text)" }}>{label}</span>
      </span>
      <span className="relative mt-1.5 block text-[0.82rem] leading-snug" style={{ color: "var(--text-muted)" }}>{desc}</span>
    </motion.button>
  );
}

function MethodBtn({
  v,
  label,
  selected,
  onSelect,
}: {
  v: ResolveMethod;
  label: string;
  selected: ResolveMethod;
  onSelect: (v: ResolveMethod) => void;
}) {
  const on = selected === v;
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={() => onSelect(v)}
      className="flex-1 rounded-xl py-3 text-[0.92rem] font-semibold transition"
      style={{
        background: on ? rgba(CORAL, 0.12) : "var(--surface-2)",
        border: `1px solid ${on ? CORAL : "rgba(var(--border-rgb),0.09)"}`,
        color: on ? CORAL : "var(--text-muted)",
        boxShadow: "inset 0 1px 0 var(--edge)",
      }}
    >
      {label}
    </motion.button>
  );
}

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
  const [type, setType] = useState<BasketType>("etkinlik");
  const [method, setMethod] = useState<ResolveMethod>("vote");
  const [busy, setBusy] = useState(false);

  const accent = type === "hackathon" ? GOLD : CORAL;
  const ready = title.trim().length >= 2 && !busy;

  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    await onCreate({ title: title.trim(), type, resolve_method: type === "hackathon" ? "vote" : method });
    setBusy(false);
    setTitle("");
    setType("etkinlik");
    setMethod("vote");
    onClose();
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
            className="grain relative w-full max-w-[460px] overflow-hidden rounded-[26px] p-8"
            style={{
              background: "linear-gradient(180deg, var(--sheen), transparent 38%), var(--card)",
              border: "1px solid rgba(var(--border-rgb),0.1)",
              boxShadow: "0 50px 120px -40px rgba(0,0,0,0.9), inset 0 1px 0 var(--edge)",
            }}
            initial={{ scale: 0.96, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 16 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-[1.4rem] font-bold" style={{ color: "var(--text)" }}>Yeni sepet</h2>
            <p className="mt-1 text-[0.9rem]" style={{ color: "var(--text-muted)" }}>Ekibe bir karar sor.</p>

            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Ne konuşuyoruz? (ör. akşam nereye gidelim)"
              className="relative mt-5 w-full rounded-2xl px-5 py-4 text-[1rem] outline-none"
              style={{ background: "var(--surface-2)", border: "1px solid rgba(var(--border-rgb),0.12)", color: "var(--text)" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = rgba(accent, 0.6))}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(var(--border-rgb),0.1)")}
            />

            <div className="mt-4 grid grid-cols-2 gap-3">
              <TypeCard
                v="etkinlik"
                label="Etkinlik"
                desc="fikir at, oy ver / kura"
                selected={type}
                onSelect={setType}
              />
              <TypeCard
                v="hackathon"
                label="Hackathon"
                desc="lobi · takım · demo (lobide kurulur)"
                selected={type}
                onSelect={setType}
              />
            </div>

            <AnimatePresence initial={false}>
              {type === "etkinlik" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 flex gap-3">
                    <MethodBtn v="vote" label="Oylama" selected={method} onSelect={setMethod} />
                    <MethodBtn v="raffle" label="Kura" selected={method} onSelect={setMethod} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-7 flex items-center justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded-full px-5 py-[11px] text-[0.92rem] font-semibold transition hover:bg-[rgba(var(--border-rgb),0.05)]"
                style={{ color: "var(--text-muted)" }}
              >
                Vazgeç
              </button>
              <button
                onClick={submit}
                disabled={!ready}
                className="rounded-full px-6 py-[11px] text-[0.92rem] font-bold transition hover:-translate-y-px disabled:translate-y-0"
                style={{ background: ready ? accent : "var(--surface-2)", color: ready ? "#0F0F0F" : "var(--text-faint)" }}
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

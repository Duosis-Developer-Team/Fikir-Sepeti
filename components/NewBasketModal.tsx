"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { BasketType, ResolveMethod } from "@/lib/types";

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

  const submit = async () => {
    if (title.trim().length < 2 || busy) return;
    setBusy(true);
    await onCreate({ title: title.trim(), type, resolve_method: method });
    setBusy(false);
    setTitle("");
    setType("social");
    setMethod("vote");
    onClose();
  };

  const accent = type === "build" ? "var(--accent-build)" : "var(--accent-social)";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/25 px-4 pb-4 backdrop-blur-sm sm:items-center sm:pb-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-md rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm"
            initial={{ scale: 0.96, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 16 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-medium">Yeni sepet</h2>

            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Ne konuşuyoruz? (ör. akşam nereye gidelim)"
              className="mt-4 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--text-muted)]"
            />

            <div className="mt-4 grid grid-cols-2 gap-2">
              {(["social", "build"] as BasketType[]).map((t) => {
                const active = type === t;
                const c = t === "build" ? "var(--accent-build)" : "var(--accent-social)";
                return (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className="rounded-lg border px-3 py-3 text-left transition"
                    style={{
                      borderColor: active ? c : "var(--border)",
                      background: active ? `${c}10` : "var(--surface)",
                    }}
                  >
                    <span className="block text-sm font-medium" style={{ color: active ? c : undefined }}>
                      {t === "build" ? "Build" : "Sosyal"}
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                      {t === "build" ? "iç hackathon akışı" : "fikir at, oy ver / kura"}
                    </span>
                  </button>
                );
              })}
            </div>

            {type === "social" && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(["vote", "raffle"] as ResolveMethod[]).map((m) => {
                  const active = method === m;
                  return (
                    <button
                      key={m}
                      onClick={() => setMethod(m)}
                      className="rounded-lg border px-3 py-2 text-sm transition"
                      style={{
                        borderColor: active ? accent : "var(--border)",
                        background: active ? `${accent}10` : "var(--surface)",
                        color: active ? accent : "var(--text-muted)",
                      }}
                    >
                      {m === "vote" ? "Oylama" : "Kura"}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-[var(--text-muted)]">
                Vazgeç
              </button>
              <button
                onClick={submit}
                disabled={title.trim().length < 2 || busy}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-40"
                style={{ background: accent }}
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

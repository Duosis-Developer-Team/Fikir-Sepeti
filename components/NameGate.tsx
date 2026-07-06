"use client";

import { createContext, useContext, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { getStoredName, storeName } from "@/lib/name";

const NameContext = createContext<{ name: string; setName: (n: string) => void }>({
  name: "",
  setName: () => {},
});

export function useNameContext() {
  return useContext(NameContext);
}

export default function NameGate({ children }: { children: React.ReactNode }) {
  // localStorage senkron okunur (client component) — ilk render'da doğru isim.
  const [name, setNameState] = useState<string>(() =>
    typeof window === "undefined" ? "" : getStoredName()
  );
  const [draft, setDraft] = useState("");

  const commit = () => {
    const clean = draft.trim();
    if (clean.length < 2) return;
    storeName(clean);
    setNameState(clean);
  };

  return (
    <NameContext.Provider value={{ name, setName: setNameState }}>
      {children}
      <AnimatePresence>
        {!name && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg)]/85 px-6 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-sm rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-7 shadow-sm"
              initial={{ scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            >
              <h1 className="text-lg font-medium">Fikir Sepeti</h1>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Başlamak için adını yaz. Oyların ve fikirlerin buna bağlanır.
              </p>
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && commit()}
                placeholder="Adın"
                className="mt-4 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent-social)]"
              />
              <button
                onClick={commit}
                disabled={draft.trim().length < 2}
                className="mt-3 w-full rounded-lg bg-[var(--text)] py-2.5 text-sm font-medium text-white transition disabled:opacity-40"
              >
                Devam
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </NameContext.Provider>
  );
}

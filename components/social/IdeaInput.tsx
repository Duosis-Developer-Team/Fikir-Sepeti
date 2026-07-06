"use client";

import { useState } from "react";

export function IdeaInput({
  onAdd,
  accent = "social",
  withTag = false,
  placeholder = "Fikrini yaz…",
}: {
  onAdd: (text: string, tag: string | null) => Promise<void>;
  accent?: "social" | "build";
  withTag?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const [tag, setTag] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const accentVar = accent === "build" ? "var(--accent-build)" : "var(--accent-social)";

  const submit = async () => {
    if (text.trim().length < 2 || busy) return;
    setBusy(true);
    await onAdd(text.trim(), tag || null);
    setBusy(false);
    setText("");
    setTag("");
  };

  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--text-muted)]"
        />
        <button
          onClick={submit}
          disabled={text.trim().length < 2 || busy}
          className="shrink-0 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition disabled:opacity-40"
          style={{ background: accentVar }}
        >
          Ekle
        </button>
      </div>
      {withTag && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {["AI", "backend", "mobil", "web", "ops"].map((t) => {
            const active = tag === t;
            return (
              <button
                key={t}
                onClick={() => setTag(active ? "" : t)}
                className="rounded-full border px-2.5 py-1 text-xs transition"
                style={{
                  borderColor: active ? accentVar : "var(--border)",
                  background: active ? `${accentVar}12` : "var(--surface)",
                  color: active ? accentVar : "var(--text-muted)",
                }}
              >
                {t}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

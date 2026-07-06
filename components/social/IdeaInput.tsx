"use client";

import { useState } from "react";
import { soft, type Accent } from "@/lib/accent";

export function IdeaInput({
  onAdd,
  accent,
  withTag = false,
  placeholder = "Fikrini yaz…",
}: {
  onAdd: (text: string, tag: string | null) => Promise<void>;
  accent: Accent;
  withTag?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const [tag, setTag] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (text.trim().length < 2 || busy) return;
    setBusy(true);
    await onAdd(text.trim(), tag || null);
    setBusy(false);
    setText("");
    setTag("");
  };

  return (
    <div>
      <div className="flex gap-[10px]">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-[14px] px-[18px] py-[15px] text-[1rem] outline-none"
          style={{ background: "#242424", border: "1px solid rgba(255,255,255,0.10)", color: "#EDEDED" }}
          onFocus={(e) => (e.currentTarget.style.borderColor = soft(accent, 0.6))}
          onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)")}
        />
        <button
          onClick={submit}
          disabled={text.trim().length < 2 || busy}
          className="shrink-0 rounded-[14px] px-6 text-[0.95rem] font-semibold transition disabled:opacity-40"
          style={{ background: soft(accent, 0.14), color: accent.base }}
        >
          Ekle
        </button>
      </div>
      {withTag && (
        <div className="mt-[10px] flex flex-wrap gap-1.5">
          {["AI", "backend", "mobil", "web", "ops"].map((t) => {
            const active = tag === t;
            return (
              <button
                key={t}
                onClick={() => setTag(active ? "" : t)}
                className="rounded-full px-[13px] py-[7px] text-[0.84rem] transition"
                style={{
                  background: active ? soft(accent, 0.16) : "#242424",
                  border: `1px solid ${active ? soft(accent, 0.5) : "rgba(255,255,255,0.10)"}`,
                  color: active ? accent.base : "#9A9A9A",
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

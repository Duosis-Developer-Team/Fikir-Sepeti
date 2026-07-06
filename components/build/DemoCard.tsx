"use client";

import { useState } from "react";
import { updateDemo } from "@/lib/db";
import { soft, type Accent } from "@/lib/accent";
import type { Idea } from "@/lib/types";

export function DemoCard({ idea, accent }: { idea: Idea; accent: Accent }) {
  const [url, setUrl] = useState(idea.demo_url ?? "");
  const [presenter, setPresenter] = useState(idea.presenter ?? "");
  const [liveAt, setLiveAt] = useState(idea.live_at ?? "");
  const [saved, setSaved] = useState(false);

  const save = async () => {
    await updateDemo(idea.id, { demo_url: url.trim() || null, presenter: presenter.trim() || null, live_at: liveAt.trim() || null });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const field = "w-full rounded-xl px-3 py-[10px] text-sm outline-none";
  const fieldStyle = { background: "#181818", border: "1px solid rgba(255,255,255,0.10)", color: "#EDEDED" } as const;

  return (
    <div className="rounded-2xl p-4" style={{ background: "#242424", border: "1px solid rgba(255,255,255,0.09)" }}>
      <div className="flex items-center gap-2">
        <p className="font-display text-[1.1rem] font-semibold" style={{ color: "#EDEDED" }}>{idea.text}</p>
        {idea.tag && <span className="rounded-full px-[11px] py-[5px] text-[0.78rem] font-semibold" style={{ background: soft(accent, 0.14), color: accent.base }}>{idea.tag}</span>}
      </div>
      <div className="mt-3 grid gap-2">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Demo linki (video / canlı)" className={field} style={fieldStyle} />
        <div className="grid grid-cols-2 gap-2">
          <input value={presenter} onChange={(e) => setPresenter(e.target.value)} placeholder="Sunan kişi" className={field} style={fieldStyle} />
          <input value={liveAt} onChange={(e) => setLiveAt(e.target.value)} placeholder="Saat (ör. 15:30)" className={field} style={fieldStyle} />
        </div>
      </div>
      <button onClick={save} className="mt-3 rounded-full px-4 py-2 text-[0.82rem] font-semibold" style={{ background: soft(accent, 0.14), color: accent.base }}>
        {saved ? "Kaydedildi ✓" : "Kaydet"}
      </button>
    </div>
  );
}

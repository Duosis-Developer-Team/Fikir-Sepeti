"use client";

import { useState } from "react";
import { updateDemo } from "@/lib/db";
import type { Idea } from "@/lib/types";

export function DemoCard({ idea }: { idea: Idea }) {
  const [url, setUrl] = useState(idea.demo_url ?? "");
  const [presenter, setPresenter] = useState(idea.presenter ?? "");
  const [liveAt, setLiveAt] = useState(idea.live_at ?? "");
  const [saved, setSaved] = useState(false);

  const save = async () => {
    await updateDemo(idea.id, {
      demo_url: url.trim() || null,
      presenter: presenter.trim() || null,
      live_at: liveAt.trim() || null,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const field =
    "w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--accent-build)]";

  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center gap-2">
        <p className="font-medium">{idea.text}</p>
        {idea.tag && (
          <span
            className="rounded-full px-2 py-0.5 text-xs"
            style={{ background: "var(--accent-build-soft)", color: "var(--accent-build)" }}
          >
            {idea.tag}
          </span>
        )}
      </div>
      <div className="mt-3 grid gap-2">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Demo linki (video / canlı)" className={field} />
        <div className="grid grid-cols-2 gap-2">
          <input value={presenter} onChange={(e) => setPresenter(e.target.value)} placeholder="Sunan kişi" className={field} />
          <input value={liveAt} onChange={(e) => setLiveAt(e.target.value)} placeholder="Saat (ör. 15:30)" className={field} />
        </div>
      </div>
      <button
        onClick={save}
        className="mt-3 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition"
        style={{ background: "var(--accent-build)" }}
      >
        {saved ? "Kaydedildi ✓" : "Kaydet"}
      </button>
    </div>
  );
}

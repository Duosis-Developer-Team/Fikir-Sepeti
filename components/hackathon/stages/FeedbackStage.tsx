"use client";

import { useCallback, useEffect, useState } from "react";
import { addFeedback, listFeedback } from "@/lib/hackathon";
import { supabase } from "@/lib/supabase";
import type { Feedback } from "@/lib/types";
import type { StageContext } from "../contract";
import { dim } from "../contract";
import { Card, GoldButton, StageHeadline, initials } from "../ui";

export function FeedbackStage({ data, user }: StageContext) {
  const { basket } = data;
  const [items, setItems] = useState<Feedback[]>([]);
  const [draft, setDraft] = useState("");

  const load = useCallback(() => {
    listFeedback(basket.id).then(setItems);
  }, [basket.id]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`fb:${basket.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "feedback", filter: `basket_id=eq.${basket.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [basket.id, load]);

  const submit = async () => {
    const t = draft.trim();
    if (t.length < 2) return;
    await addFeedback({ basket_id: basket.id, author_id: user.email, author_name: user.name, text: t });
    setDraft("");
    load();
  };

  return (
    <div className="mx-auto max-w-[720px]">
      <StageHeadline pre="Ne" accent="eksik" post="?" sub="Eleştiri, öneri, 'şunu da ekleyin' — hepsi buraya." />

      <Card>
        <div className="flex gap-2.5">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Yorumunu yaz…" className="flex-1 rounded-xl px-4 py-3 text-[1rem] outline-none" style={{ background: "#2A2A2A", border: "1px solid rgba(255,255,255,0.09)", color: "#EDEDED" }} />
          <GoldButton onClick={submit} disabled={draft.trim().length < 2}>Gönder</GoldButton>
        </div>
      </Card>

      <div className="mt-4 flex flex-col gap-2.5">
        {items.map((f) => (
          <div key={f.id} className="flex gap-3 rounded-2xl px-4 py-3" style={{ background: "#242424", border: "1px solid rgba(255,255,255,0.08)" }}>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[0.8rem] font-bold" style={{ background: "#3a3a3a", color: "#EDEDED" }}>{initials(f.author_name || f.author_id || "?")}</span>
            <div className="min-w-0">
              <p className="text-[0.8rem]" style={{ color: dim(0.5) }}>{f.author_name || f.author_id}</p>
              <p className="text-[0.98rem]" style={{ color: "#EDEDED" }}>{f.text}</p>
            </div>
          </div>
        ))}
        {!items.length && <p className="py-8 text-center text-[0.9rem]" style={{ color: dim(0.4) }}>İlk yorumu sen yaz.</p>}
      </div>
    </div>
  );
}

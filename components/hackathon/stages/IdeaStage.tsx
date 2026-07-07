"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { addIdea } from "@/lib/db";
import { setSelectedIdea } from "@/lib/hackathon";
import { supabase } from "@/lib/supabase";
import type { StageContext } from "../contract";
import { GOLD, GOLD_SOFT, dim } from "../contract";
import { Card, GoldButton, StageHeadline, Avatar } from "../ui";

export function IdeaStage(ctx: StageContext) {
  const { data, config, user, isAdmin, refresh } = ctx;
  const { basket, ideas } = data;
  const selected = ideas.find((i) => i.id === basket.selected_idea_id) ?? null;
  const [draft, setDraft] = useState("");
  const [myVoteId, setMyVoteId] = useState<string | null>(null);

  // kullanıcının pool oyunu takip et (hangi fikre oy verdi)
  useEffect(() => {
    supabase
      .from("votes")
      .select("idea_id")
      .eq("basket_id", basket.id)
      .eq("phase", "idea")
      .eq("voter", user.email)
      .maybeSingle()
      .then(({ data }) => setMyVoteId((data?.idea_id as string) ?? null));
  }, [basket.id, user.email, ideas]);

  const submitIdea = async () => {
    const t = draft.trim();
    if (t.length < 2) return;
    const created = await addIdea({ basket_id: basket.id, text: t, created_by: user.email });
    setDraft("");
    if (config.ideaSource === "static" && created) await setSelectedIdea(basket.id, created.id);
    refresh();
  };

  const voteFor = async (ideaId: string) => {
    await supabase.from("votes").delete().eq("basket_id", basket.id).eq("phase", "idea").eq("voter", user.email);
    await supabase.from("votes").insert({ idea_id: ideaId, basket_id: basket.id, phase: "idea", voter: user.email });
    refresh();
  };
  const lockTop = async () => {
    const top = [...ideas].sort((a, b) => b.vote_count - a.vote_count)[0];
    if (top) { await setSelectedIdea(basket.id, top.id); refresh(); }
  };
  const drawRandom = async () => {
    if (!ideas.length) return;
    const pick = ideas[Math.floor(Math.random() * ideas.length)];
    await setSelectedIdea(basket.id, pick.id);
    refresh();
  };

  // seçilmiş fikir → herkes görür
  if (selected) {
    return (
      <div className="mx-auto max-w-[760px]">
        <StageHeadline pre="Fikir" accent="belli" sub="Sıra takımlarda." />
        <Card className="text-center">
          <h2 className="font-display text-[clamp(2rem,4vw,3rem)] font-extrabold leading-tight" style={{ color: GOLD }}>{selected.text}</h2>
        </Card>
      </div>
    );
  }

  // static: sadece admin girer
  if (config.ideaSource === "static") {
    return (
      <div className="mx-auto max-w-[640px]">
        <StageHeadline pre="Fikri" accent="koy" sub={isAdmin ? "Üzerinde çalışacağınız tek fikir." : undefined} />
        {isAdmin ? (
          <Card>
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder="Örn: PR'ları otomatik özetleyen bot" className="w-full resize-none rounded-xl px-4 py-3 text-[1.1rem] outline-none" style={{ background: "#2A2A2A", border: "1px solid rgba(255,255,255,0.09)", color: "#EDEDED" }} />
            <div className="mt-4 flex justify-center"><GoldButton onClick={submitIdea} disabled={draft.trim().length < 2}>Fikri belirle →</GoldButton></div>
          </Card>
        ) : (
          <p className="text-center text-[1rem]" style={{ color: dim(0.5) }}>Admin fikri giriyor…</p>
        )}
      </div>
    );
  }

  // pool: herkes yazar → oy / kura
  const isVote = config.poolSelect === "vote";
  const sorted = [...ideas].sort((a, b) => b.vote_count - a.vote_count);
  return (
    <div className="mx-auto max-w-[760px]">
      <StageHeadline pre="Fikirleri" accent="dök" sub={config.poolSelect === "random" ? "Herkes yazsın; birini kura seçecek." : "Herkes yazsın; en çok oyu alan kazanır."} />

      {/* büyük input */}
      <div className="flex items-stretch gap-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitIdea()}
          placeholder="Fikrini yaz…"
          className="flex-1 rounded-2xl px-6 py-5 text-[1.2rem] outline-none transition focus:border-[rgba(231,169,63,0.5)]"
          style={{ background: "#2A2A2A", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEDED" }}
        />
        <GoldButton onClick={submitIdea} disabled={draft.trim().length < 2}>Ekle</GoldButton>
      </div>

      {/* fikir listesi */}
      <div className="mt-6 flex flex-col gap-3">
        <AnimatePresence initial={false}>
          {sorted.map((idea) => {
            const mine = idea.id === myVoteId;
            return (
              <motion.div
                key={idea.id}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ type: "spring", stiffness: 320, damping: 30 }}
                className="flex items-center gap-4 rounded-[20px] px-5 py-4"
                style={{ background: mine ? "rgba(231,169,63,0.1)" : "#242424", border: `1px solid ${mine ? GOLD : "rgba(255,255,255,0.08)"}` }}
              >
                <Avatar name={idea.created_by ?? "?"} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[1.18rem] font-semibold" style={{ color: "#EDEDED" }}>{idea.text}</p>
                  {idea.created_by && <p className="truncate text-[0.82rem]" style={{ color: dim(0.42) }}>{idea.created_by}</p>}
                </div>
                {isVote && (
                  <div className="flex items-center gap-3.5">
                    <span className="tnum font-display text-[1.7rem] font-bold" style={{ color: mine ? GOLD : GOLD_SOFT }}>{idea.vote_count}</span>
                    <motion.button
                      whileTap={{ scale: 0.94 }}
                      onClick={() => voteFor(idea.id)}
                      className="rounded-full px-5 py-2.5 text-[0.9rem] font-semibold transition"
                      style={mine ? { background: GOLD, color: "#17150F" } : { border: "1px solid rgba(255,255,255,0.2)", color: dim(0.85) }}
                    >
                      {mine ? "✓ oyun" : "oy ver"}
                    </motion.button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
        {!sorted.length && <p className="py-10 text-center text-[1rem]" style={{ color: dim(0.4) }}>Havuz boş — ilk fikri sen at.</p>}
      </div>

      {isAdmin && ideas.length > 0 && (
        <div className="mt-8 flex justify-center">
          {config.poolSelect === "random"
            ? <GoldButton onClick={drawRandom}>🎲 Kura çek</GoldButton>
            : <GoldButton onClick={lockTop}>En çok oyu seç →</GoldButton>}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { addIdea } from "@/lib/db";
import { lockIdeas, setSelectedIdea } from "@/lib/hackathon";
import { pickRandomIdeas } from "@/lib/assignment";
import { apiFetch } from "@/lib/api-headers";
import { uploadIdeaAttachment } from "@/lib/attachments";
import { ACCENTS } from "@/lib/accent";
import type { Idea } from "@/lib/types";
import { RaffleRevealStage } from "@/components/shared/RaffleRevealStage";
import { IdeaAttachment } from "../IdeaAttachment";
import type { StageContext } from "../contract";
import { GOLD, GOLD_SOFT, dim } from "../contract";
import { Card, GoldButton, StageHeadline, Avatar } from "../ui";

export function IdeaStage(ctx: StageContext) {
  const { data, config, user, isAdmin, refresh, readOnly } = ctx;
  const { basket, ideas } = data;
  const selected = ideas.find((i) => i.id === basket.selected_idea_id) ?? null;
  const [draft, setDraft] = useState("");
  const [myVoteId, setMyVoteId] = useState<string | null>(null);
  const [rafflePick, setRafflePick] = useState<Idea[] | null>(null);

  // "Fikir var" (static) formu: başlık + açıklama + opsiyonel dosya eki.
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [submittingStatic, setSubmittingStatic] = useState(false);

  useEffect(() => {
    // Kendi oyunu okumak `vote.view_all` izni gerektirmiyor; sunucu bunu
    // list_my_votes RPC'siyle ayırıyor (S3 kararı, korundu).
    void apiFetch<{ myVotes: { phase: string; idea_id: string }[] }>(
      `/api/basket/${basket.id}/live`
    ).then((res) => {
      const mine = res.data?.myVotes?.find((v) => v.phase === "idea");
      setMyVoteId(mine?.idea_id ?? null);
    });
  }, [basket.id, user.email, ideas]);

  const submitIdea = async () => {
    if (readOnly) return;
    const t = draft.trim();
    if (t.length < 2) return;
    const created = await addIdea({
      basket_id: basket.id,
      text: t,
      created_by: user.email,
      tenant_id: basket.tenant_id,
    });
    setDraft("");
    if (config.ideaSource === "static" && created) await setSelectedIdea(basket.id, created.id);
    refresh();
  };

  const submitStaticIdea = async () => {
    if (readOnly || submittingStatic) return;
    const t = title.trim();
    if (t.length < 2) return;
    setSubmittingStatic(true);
    const created = await addIdea({
      basket_id: basket.id,
      text: t,
      description: description.trim() || null,
      created_by: user.email,
      tenant_id: basket.tenant_id,
    });
    if (created && file) {
      await uploadIdeaAttachment(created.id, file);
    }
    if (created) await setSelectedIdea(basket.id, created.id);
    setTitle("");
    setDescription("");
    setFile(null);
    setSubmittingStatic(false);
    refresh();
  };

  const voteFor = async (ideaId: string) => {
    if (readOnly) return;
    await apiFetch(`/api/basket/${basket.id}/vote`, {
      method: "POST",
      email: user.email,
      tenantId: basket.tenant_id,
      body: JSON.stringify({ idea_id: ideaId, phase: "idea" }),
    });
    refresh();
  };
  const lockTop = async () => {
    const count = Math.max(1, config.ideaCount ?? 1);
    const top = [...ideas].sort((a, b) => b.vote_count - a.vote_count).slice(0, count);
    if (!top.length) return;
    await lockIdeas(
      basket.id,
      top.map((i) => i.id),
      config
    );
    refresh();
  };

  /** Pick winner(s) first, then optionally show raffle stage. */
  const drawRandom = () => {
    if (!ideas.length) return;
    const count = Math.max(1, config.ideaCount ?? 1);
    const picks = pickRandomIdeas(ideas, count);
    if (!picks.length) return;
    const animate = config.revealAnimation !== false;
    if (!animate) {
      void lockIdeas(
        basket.id,
        picks.map((i) => i.id),
        config
      ).then(refresh);
      return;
    }
    setRafflePick(picks);
  };

  const commitRaffle = async () => {
    if (!rafflePick?.length) return;
    await lockIdeas(
      basket.id,
      rafflePick.map((i) => i.id),
      config
    );
    setRafflePick(null);
    refresh();
  };

  if (selected) {
    const fromJar = config.ideaSource === "repo";
    const locked =
      config.lockedIdeaIds?.length
        ? ideas.filter((i) => config.lockedIdeaIds!.includes(i.id))
        : [selected];
    return (
      <div className="mx-auto max-w-[760px]">
        <StageHeadline
          pre={fromJar ? "Sepetten" : "Fikir"}
          accent={fromJar ? "geldi" : "belli"}
          sub="Sıra takımlarda."
        />
        <div className="flex flex-col gap-3">
          {locked.map((idea) => (
            <Card key={idea.id} className="text-center">
              <h2 className="font-display text-[clamp(1.6rem,3.4vw,2.6rem)] font-extrabold leading-tight" style={{ color: GOLD }}>
                {idea.text}
              </h2>
              {idea.description && (
                <p className="mt-3 text-[1rem] leading-relaxed" style={{ color: dim(0.65) }}>
                  {idea.description}
                </p>
              )}
              <IdeaAttachment ideaId={idea.id} />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (config.ideaSource === "static") {
    const onDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) setFile(f);
    };
    return (
      <div className="mx-auto max-w-[640px]">
        <StageHeadline pre="Fikri" accent="koy" sub={isAdmin ? "Üzerinde çalışacağınız tek fikir." : undefined} />
        {isAdmin ? (
          <Card>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Başlık — örn: PR'ları otomatik özetleyen bot"
              className="w-full rounded-xl px-4 py-3 text-[1.1rem] outline-none"
              style={{ background: "var(--surface-2)", border: "1px solid rgba(var(--border-rgb),0.09)", color: "var(--text)" }}
              data-testid="static-idea-title"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Açıklama (opsiyonel) — konunun içeriğini, kapsamını anlat"
              className="mt-3 w-full resize-none rounded-xl px-4 py-3 text-[0.98rem] outline-none"
              style={{ background: "var(--surface-2)", border: "1px solid rgba(var(--border-rgb),0.09)", color: "var(--text)" }}
              data-testid="static-idea-description"
            />
            <label
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className="mt-3 flex cursor-pointer flex-col items-center gap-1.5 rounded-xl px-4 py-6 text-center transition"
              style={{
                background: dragOver ? "rgba(231,169,63,0.1)" : "var(--surface-2)",
                border: `1px dashed ${dragOver ? GOLD : "rgba(var(--border-rgb),0.2)"}`,
              }}
              data-testid="static-idea-file-drop"
            >
              <input
                type="file"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <span className="text-[0.92rem]" style={{ color: GOLD_SOFT }}>📎 {file.name} — değiştirmek için tıkla</span>
              ) : (
                <span className="text-[0.9rem]" style={{ color: dim(0.5) }}>
                  Dosya sürükle bırak ya da tıklayıp seç (opsiyonel)
                </span>
              )}
            </label>
            <div className="mt-4 flex justify-center">
              <GoldButton onClick={submitStaticIdea} disabled={submittingStatic || title.trim().length < 2}>
                {submittingStatic ? "…" : "Fikri belirle →"}
              </GoldButton>
            </div>
          </Card>
        ) : (
          <p className="text-center text-[1rem]" style={{ color: dim(0.5) }}>Admin fikri giriyor…</p>
        )}
      </div>
    );
  }

  const isVote = config.poolSelect === "vote";
  const isRepo = config.ideaSource === "repo";
  const sorted = [...ideas].sort((a, b) => b.vote_count - a.vote_count);
  const rafflePrimary = rafflePick?.[0] ?? null;

  return (
    <div className="mx-auto max-w-[760px]">
      <StageHeadline
        pre={isRepo ? "Sepetten" : "Fikirleri"}
        accent={isRepo ? "gelenler" : "dök"}
        sub={
          isRepo
            ? config.poolSelect === "random"
              ? "Lobide seçilen adaylar arasından kura çekilecek."
              : "Lobide seçilen adaylar arasından en çok oyu alan kazanır."
            : config.poolSelect === "random"
              ? "Herkes yazsın; birini kura seçecek."
              : "Herkes yazsın; en çok oyu alan kazanır."
        }
      />

      {!isRepo && (
        <div className="flex items-stretch gap-3">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitIdea()}
            placeholder="Fikrini yaz…"
            className="flex-1 rounded-2xl px-6 py-5 text-[1.2rem] outline-none transition focus:border-[rgba(231,169,63,0.5)]"
            style={{ background: "var(--surface-2)", border: "1px solid rgba(var(--border-rgb),0.1)", color: "var(--text)" }}
          />
          <GoldButton onClick={submitIdea} disabled={readOnly || draft.trim().length < 2}>Ekle</GoldButton>
        </div>
      )}

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
                style={{ background: mine ? "rgba(231,169,63,0.1)" : "var(--card)", border: `1px solid ${mine ? GOLD : "rgba(var(--border-rgb),0.08)"}`, boxShadow: "var(--card-shadow)" }}
              >
                <Avatar name={idea.created_by ?? "?"} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[1.18rem] font-semibold" style={{ color: "var(--text)" }}>{idea.text}</p>
                  {idea.created_by && <p className="truncate text-[0.82rem]" style={{ color: dim(0.42) }}>{idea.created_by}</p>}
                </div>
                {isVote && (
                  <div className="flex items-center gap-3.5">
                    <span className="tnum font-display text-[1.7rem] font-bold" style={{ color: mine ? GOLD : GOLD_SOFT }}>{idea.vote_count}</span>
                    <motion.button
                      type="button"
                      disabled={readOnly}
                      whileTap={{ scale: 0.94 }}
                      onClick={() => voteFor(idea.id)}
                      className="rounded-full px-5 py-2.5 text-[0.9rem] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                      style={mine ? { background: GOLD, color: "#17150F" } : { border: "1px solid rgba(var(--border-rgb),0.2)", color: dim(0.85) }}
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

      {rafflePrimary && (
        <RaffleRevealStage
          title={basket.title}
          labels={ideas.map((i) => i.text)}
          winnerLabel={rafflePrimary.text}
          accent={ACCENTS.gold}
          enabled={config.revealAnimation !== false}
          eyebrow="Fikir kura"
          onComplete={() => void commitRaffle()}
          onSkip={() => void commitRaffle()}
        />
      )}
    </div>
  );
}

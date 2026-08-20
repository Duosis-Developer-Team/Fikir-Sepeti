"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { useNameContext } from "@/components/AuthGate";
import { POOL_ACCENT, soft } from "@/lib/accent";
import { createPoolIdea, promotePoolIdeas } from "@/lib/pool";
import { useRealtimePool, type PromotedBasketInfo } from "@/lib/useRealtimePool";
import type { BasketType, PoolIdea, PoolStatus } from "@/lib/types";

const CLAY = POOL_ACCENT;
const STATUS_LABEL: Record<PoolStatus, string> = {
  new: "yeni",
  voting: "oylanıyor",
  promoted: "organize edildi",
  archived: "arşiv",
  rejected: "reddedildi",
};

const CATEGORIES = ["ürün", "süreç", "kültür", "teknoloji", "diğer"];
type TrackHint = "hackathon" | "etkinlik" | null;
const TRACK_LABEL: Record<"all" | "hackathon" | "etkinlik" | "genel", string> = {
  all: "tümü",
  genel: "fikir",
  hackathon: "hackathon fikri",
  etkinlik: "etkinlik fikri",
};

export function PoolPanel() {
  const { name, tenantId } = useNameContext();
  const router = useRouter();
  const { ideas, myVotes, promotedBaskets, loading, vote, refresh } = useRealtimePool(tenantId, name);

  const [text, setText] = useState("");
  const [brief, setBrief] = useState("");
  const [category, setCategory] = useState("");
  const [trackHint, setTrackHint] = useState<TrackHint>(null);
  const [filterCat, setFilterCat] = useState<string>("all");
  const [trackFilter, setTrackFilter] = useState<"all" | "hackathon" | "etkinlik" | "genel">("all");
  const [query, setQuery] = useState("");
  const [pollHours, setPollHours] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [promoteType, setPromoteType] = useState<BasketType>("hackathon");
  const [busy, setBusy] = useState(false);
  const [pollOption, setPollOption] = useState("");

  // Poll seçenekleri (parent_idea_id dolu) ana listede ayrı kart değil — kök
  // fikrin altında görünür (FS-05).
  const rootIdeas = useMemo(() => ideas.filter((i) => !i.parent_idea_id), [ideas]);
  const optionsByParent = useMemo(() => {
    const map = new Map<string, PoolIdea[]>();
    for (const i of ideas) {
      if (!i.parent_idea_id) continue;
      const list = map.get(i.parent_idea_id) ?? [];
      list.push(i);
      map.set(i.parent_idea_id, list);
    }
    return map;
  }, [ideas]);

  const filtered = useMemo(() => {
    return rootIdeas.filter((i) => {
      if (trackFilter !== "all") {
        const track = i.track_hint ?? "genel";
        if (track !== trackFilter) return false;
      }
      if (filterCat !== "all" && (i.category ?? "") !== filterCat) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        const hay = `${i.text} ${i.brief ?? ""} ${i.category ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rootIdeas, trackFilter, filterCat, query]);

  const openPoll = useMemo(
    () => ideas.some((i) => i.status === "voting" && (!i.poll_closes_at || new Date(i.poll_closes_at) > new Date())),
    [ideas]
  );

  const submit = async () => {
    if (!tenantId || text.trim().length < 2) return;
    setBusy(true);
    const closes =
      pollHours > 0 ? new Date(Date.now() + pollHours * 3600_000).toISOString() : null;
    await createPoolIdea({
      text: text.trim(),
      brief: trackHint ? null : brief.trim() || null,
      category: trackHint ? null : category || null,
      track_hint: trackHint,
      poll_closes_at: closes,
      status: closes ? "voting" : "new",
      created_by: name,
      tenant_id: tenantId,
    });
    setText("");
    setBrief("");
    setPollHours(0);
    setBusy(false);
    void refresh();
  };

  const addPollOption = async () => {
    if (!tenantId || pollOption.trim().length < 2) return;
    const open = ideas.find(
      (i) => i.status === "voting" && (!i.poll_closes_at || new Date(i.poll_closes_at) > new Date())
    );
    const closes = open?.poll_closes_at ?? new Date(Date.now() + 24 * 3600_000).toISOString();
    setBusy(true);
    await createPoolIdea({
      text: pollOption.trim(),
      brief: "Poll seçeneği",
      category: open?.category ?? null,
      poll_closes_at: closes,
      status: "voting",
      created_by: name,
      tenant_id: tenantId,
      parent_idea_id: open?.id ?? null,
    });
    setPollOption("");
    setBusy(false);
    void refresh();
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const promote = async () => {
    if (!tenantId || !selected.size) return;
    const first = ideas.find((i) => selected.has(i.id));
    const typeLabel = promoteType === "hackathon" ? "Hackathon" : "Etkinlik";
    const title = first ? first.text.slice(0, 60) : `${typeLabel} · ${new Date().toLocaleDateString("tr-TR")}`;
    setBusy(true);
    const res = await promotePoolIdeas({
      pool_idea_ids: [...selected],
      type: promoteType,
      title,
      created_by: name,
      tenant_id: tenantId,
    });
    setBusy(false);
    if (res?.basketId) router.push(`/basket/${res.basketId}`);
  };

  if (loading) {
    return (
      <div className="mt-8 grid gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-[22px]" style={{ background: "var(--card)" }} />
        ))}
      </div>
    );
  }

  return (
    <div className="mt-[clamp(28px,4vw,44px)] flex flex-col gap-6">
      <div
        className="rounded-[26px] p-[clamp(22px,3vw,36px)]"
        style={{
          background: "linear-gradient(180deg, var(--sheen), transparent 50%), var(--card)",
          border: `1px solid ${soft(CLAY, 0.35)}`,
          boxShadow: "var(--card-shadow)",
        }}
      >
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.22em]" style={{ color: CLAY.base }}>
          Sepete at
        </p>
        <div className="mt-3 flex flex-wrap gap-2" data-testid="pool-track-hint">
          {([null, "hackathon", "etkinlik"] as TrackHint[]).map((t) => {
            const on = trackHint === t;
            return (
              <button
                key={t ?? "genel"}
                type="button"
                onClick={() => setTrackHint(t)}
                className="rounded-full px-3.5 py-1.5 text-[0.8rem] font-semibold transition"
                style={
                  on
                    ? { background: CLAY.base, color: "#161616" }
                    : { border: "1px solid rgba(var(--border-rgb),0.15)", color: "var(--text-muted)" }
                }
                data-testid={`pool-track-hint-${t ?? "genel"}`}
              >
                {t === "hackathon" ? "Hackathon fikri" : t === "etkinlik" ? "Etkinlik fikri" : "Fikir"}
              </button>
            );
          })}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="Fikrini yaz — her gün, her an."
          className="mt-3 w-full resize-none rounded-2xl px-5 py-4 text-[1.15rem] outline-none"
          style={{ background: "var(--surface-2)", border: "1px solid rgba(var(--border-rgb),0.1)", color: "var(--text)" }}
          data-testid="pool-idea-input"
        />
        {!trackHint && (
          <input
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Kısa brief (opsiyonel)"
            className="mt-3 w-full rounded-xl px-4 py-3 text-[0.95rem] outline-none"
            style={{ background: "var(--surface-2)", border: "1px solid rgba(var(--border-rgb),0.08)", color: "var(--text)" }}
          />
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {!trackHint && (
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-full px-4 py-2 text-[0.85rem] outline-none"
              style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid rgba(var(--border-rgb),0.1)" }}
            >
              <option value="">kategori</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          <select
            value={pollHours}
            onChange={(e) => setPollHours(Number(e.target.value))}
            className="rounded-full px-4 py-2 text-[0.85rem] outline-none"
            style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid rgba(var(--border-rgb),0.1)" }}
            data-testid="pool-poll-hours"
          >
            <option value={0}>süresiz</option>
            <option value={1}>1 saatlik poll</option>
            <option value={24}>24 saatlik poll</option>
          </select>
          <button
            type="button"
            disabled={busy || text.trim().length < 2}
            onClick={() => void submit()}
            className="ml-auto rounded-full px-6 py-2.5 text-[0.95rem] font-bold disabled:opacity-40"
            style={{ background: CLAY.base, color: "#161616" }}
            data-testid="pool-submit"
          >
            At →
          </button>
        </div>
      </div>

      {openPoll && (
        <div
          className="flex flex-wrap items-center gap-3 rounded-2xl px-5 py-4"
          style={{ background: soft(CLAY, 0.1), border: `1px solid ${soft(CLAY, 0.3)}` }}
          data-testid="pool-add-option"
        >
          <span className="text-[0.85rem] font-semibold" style={{ color: CLAY.base }}>
            Poll açık — seçenek ekle
          </span>
          <input
            value={pollOption}
            onChange={(e) => setPollOption(e.target.value)}
            placeholder="Yeni seçenek…"
            className="min-w-[200px] flex-1 rounded-full px-4 py-2 text-[0.95rem] outline-none"
            style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid rgba(var(--border-rgb),0.1)" }}
            data-testid="pool-option-input"
          />
          <button
            type="button"
            onClick={() => void addPollOption()}
            disabled={busy || pollOption.trim().length < 2}
            className="rounded-full px-4 py-2 text-[0.85rem] font-semibold disabled:opacity-40"
            style={{ background: CLAY.base, color: "#161616" }}
            data-testid="pool-option-submit"
          >
            Ekle
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2" data-testid="pool-track-filter">
        {(["all", "genel", "hackathon", "etkinlik"] as const).map((t) => {
          const on = trackFilter === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTrackFilter(t)}
              className="rounded-full px-3.5 py-1.5 text-[0.8rem] font-semibold transition"
              style={
                on
                  ? { background: soft(CLAY, 0.18), color: CLAY.base, border: `1px solid ${soft(CLAY, 0.4)}` }
                  : { border: "1px solid rgba(var(--border-rgb),0.12)", color: "var(--text-muted)" }
              }
              data-testid={`pool-track-filter-${t}`}
            >
              {TRACK_LABEL[t]}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ara…"
          className="rounded-full px-4 py-2 text-[0.9rem] outline-none"
          style={{ background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.1)", color: "var(--text)", minWidth: 160 }}
          data-testid="pool-search"
        />
        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
          className="rounded-full px-4 py-2 text-[0.85rem] outline-none"
          style={{ background: "var(--card)", color: "var(--text)", border: "1px solid rgba(var(--border-rgb),0.1)" }}
          data-testid="pool-filter-category"
        >
          <option value="all">tüm kategoriler</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {selected.size > 0 && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <select
              value={promoteType}
              onChange={(e) => setPromoteType(e.target.value as BasketType)}
              className="rounded-full px-3 py-2 text-[0.85rem]"
              style={{ background: "var(--surface-2)", color: "var(--text)" }}
              data-testid="pool-promote-type"
            >
              <option value="hackathon">→ Hackathon</option>
              <option value="etkinlik">→ Etkinlik</option>
            </select>
            <button
              type="button"
              disabled={busy}
              onClick={() => void promote()}
              className="rounded-full px-5 py-2 text-[0.9rem] font-bold"
              style={{ background: CLAY.base, color: "#161616" }}
              data-testid="pool-promote"
            >
              Dönüştür ({selected.size})
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {filtered.map((idea) => (
          <PoolCard
            key={idea.id}
            idea={idea}
            voted={myVotes.has(idea.id)}
            selected={selected.has(idea.id)}
            promotedBasket={idea.promoted_basket_id ? promotedBaskets[idea.promoted_basket_id] : undefined}
            options={optionsByParent.get(idea.id) ?? []}
            myVotes={myVotes}
            onVote={() => void vote(idea.id)}
            onVoteOption={(id) => void vote(id)}
            onToggle={() => toggleSelect(idea.id)}
          />
        ))}
        {!filtered.length && (
          <p className="py-16 text-center text-[1rem]" style={{ color: "var(--text-muted)" }}>
            Sepet boş — ilk fikri sen at.
          </p>
        )}
      </div>
    </div>
  );
}

function PoolCard({
  idea,
  voted,
  selected,
  promotedBasket,
  options,
  myVotes,
  onVote,
  onVoteOption,
  onToggle,
}: {
  idea: PoolIdea;
  voted: boolean;
  selected: boolean;
  promotedBasket?: PromotedBasketInfo;
  options: PoolIdea[];
  myVotes: Set<string>;
  onVote: () => void;
  onVoteOption: (id: string) => void;
  onToggle: () => void;
}) {
  const closed = idea.poll_closes_at ? new Date(idea.poll_closes_at) < new Date() : false;
  const usedLabel =
    idea.status === "promoted" && idea.promoted_basket_id
      ? promotedBasket?.type === "etkinlik"
        ? "→ Etkinlik'te kullanıldı"
        : "→ Hackathon'da kullanıldı"
      : null;

  return (
    <motion.div
      layout
      className="rounded-[22px] px-5 py-4"
      style={{
        background: selected ? soft(CLAY, 0.12) : "var(--card)",
        border: `1px solid ${selected ? soft(CLAY, 0.5) : "rgba(var(--border-rgb),0.09)"}`,
        boxShadow: "var(--card-shadow)",
      }}
      data-testid={`pool-card-${idea.id}`}
    >
      <div className="flex flex-wrap items-start gap-3">
        <button
          type="button"
          onClick={onToggle}
          className="mt-1 grid h-5 w-5 place-items-center rounded border text-[0.7rem]"
          style={{
            borderColor: selected ? CLAY.base : "rgba(var(--border-rgb),0.25)",
            background: selected ? CLAY.base : "transparent",
            color: "#161616",
          }}
          aria-label="Seç"
          data-testid={`pool-select-${idea.id}`}
        >
          {selected ? "✓" : ""}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2.5 py-0.5 text-[0.68rem] font-bold uppercase tracking-wider"
              style={{ background: soft(CLAY, 0.15), color: CLAY.base }}
              data-testid={`pool-status-${idea.id}`}
            >
              {STATUS_LABEL[idea.status]}
            </span>
            {idea.track_hint && (
              <span
                className="rounded-full px-2.5 py-0.5 text-[0.68rem] font-semibold"
                style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
                data-testid={`pool-track-${idea.id}`}
              >
                {idea.track_hint === "hackathon" ? "hackathon" : "etkinlik"}
              </span>
            )}
            {idea.category && (
              <span className="text-[0.75rem]" style={{ color: "var(--text-muted)" }}>
                {idea.category}
              </span>
            )}
            {idea.source_basket_id && (
              <span className="text-[0.72rem]" style={{ color: "var(--text-faint)" }} data-testid={`pool-source-${idea.id}`}>
                kaynak sepetten
              </span>
            )}
          </div>
          <p className="mt-1 text-[1.2rem] font-semibold" style={{ color: "var(--text)" }}>
            {idea.text}
          </p>
          {idea.brief && (
            <p className="mt-1 text-[0.9rem]" style={{ color: "var(--text-muted)" }}>
              {idea.brief}
            </p>
          )}
          {usedLabel && (
            <Link
              href={`/basket/${idea.promoted_basket_id}`}
              className="mt-2 inline-block text-[0.88rem] font-medium hover:underline"
              style={{ color: CLAY.light }}
              data-testid={`pool-used-${idea.id}`}
            >
              {usedLabel}
              {idea.winner_label ? `, kazanan: ${idea.winner_label}` : ""}
            </Link>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="tnum font-display text-[1.5rem] font-bold" style={{ color: voted ? CLAY.base : CLAY.light }}>
            {idea.vote_count}
          </span>
          <button
            type="button"
            onClick={onVote}
            disabled={voted || closed || idea.status === "promoted" || idea.status === "archived"}
            className="rounded-full px-4 py-2 text-[0.85rem] font-semibold disabled:opacity-40"
            style={
              voted
                ? { background: CLAY.base, color: "#161616" }
                : { border: "1px solid rgba(var(--border-rgb),0.2)", color: "var(--text)" }
            }
            data-testid={`pool-vote-${idea.id}`}
          >
            {voted ? "✓ oyun" : closed ? "kapandı" : "oy ver"}
          </button>
        </div>
      </div>

      {options.length > 0 && (
        <div className="ml-8 mt-3 flex flex-col gap-2 border-l pl-4" style={{ borderColor: "rgba(var(--border-rgb),0.1)" }} data-testid={`pool-options-${idea.id}`}>
          <span className="text-[0.68rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
            Poll seçenekleri
          </span>
          {options.map((opt) => {
            const optVoted = myVotes.has(opt.id);
            const optClosed = opt.poll_closes_at ? new Date(opt.poll_closes_at) < new Date() : false;
            return (
              <div key={opt.id} className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5" style={{ background: "var(--surface-2)" }} data-testid={`pool-option-${opt.id}`}>
                <span className="min-w-0 flex-1 truncate text-[0.92rem]" style={{ color: "var(--text)" }}>{opt.text}</span>
                <div className="flex shrink-0 items-center gap-2.5">
                  <span className="tnum font-display text-[1rem] font-bold" style={{ color: optVoted ? CLAY.base : CLAY.light }}>{opt.vote_count}</span>
                  <button
                    type="button"
                    onClick={() => onVoteOption(opt.id)}
                    disabled={optVoted || optClosed}
                    className="rounded-full px-3 py-1.5 text-[0.78rem] font-semibold disabled:opacity-40"
                    style={
                      optVoted
                        ? { background: CLAY.base, color: "#161616" }
                        : { border: "1px solid rgba(var(--border-rgb),0.2)", color: "var(--text)" }
                    }
                    data-testid={`pool-option-vote-${opt.id}`}
                  >
                    {optVoted ? "✓ oyun" : optClosed ? "kapandı" : "oy ver"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

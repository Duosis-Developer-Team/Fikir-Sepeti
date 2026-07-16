"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useNameContext } from "@/components/AuthGate";
import { archiveCsvUrl, fetchArchiveResult } from "@/lib/archive";
import { accentFor, soft } from "@/lib/accent";
import type { Basket, Feedback, Idea, Participant, Team, TeamMember, TeamVote } from "@/lib/types";

type ResultPayload = {
  basket: Basket;
  ideas: Idea[];
  votes: { idea_id: string; phase: string; voter: string }[];
  canViewVotes?: boolean;
  participants: Participant[];
  teams: Team[];
  members: TeamMember[];
  teamVotes: TeamVote[];
  feedback: Feedback[];
  winner: Idea | null;
};

export default function BasketResultPage() {
  const { id } = useParams<{ id: string }>();
  const { name, tenantId } = useNameContext();
  const [data, setData] = useState<ResultPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId || !name || !id) return;
    void fetchArchiveResult({ basketId: id, email: name, tenantId }).then((res) => {
      if (!res) setError("Sonuç yüklenemedi veya yetkin yok.");
      else setData(res as unknown as ResultPayload);
    });
  }, [id, name, tenantId]);

  const downloadCsv = async () => {
    if (!tenantId || !name) return;
    const headers: Record<string, string> = {};
    if (process.env.NEXT_PUBLIC_AUTH_BYPASS === "1") {
      headers["X-Dev-User"] = JSON.stringify({ email: name, tenantId });
    }
    const res = await fetch(archiveCsvUrl(id), { headers });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `archive-${id.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (error) {
    return (
      <main className="mx-auto max-w-[800px] px-6 py-16 text-center">
        <p style={{ color: "var(--text-muted)" }}>{error}</p>
        <Link href="/archive" className="mt-4 inline-block" style={{ color: "#D97757" }}>
          ← Arşiv
        </Link>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-[800px] px-6 py-16">
        <div className="h-40 animate-pulse rounded-2xl" style={{ background: "var(--card)" }} />
      </main>
    );
  }

  const { basket, ideas, votes, participants, teams, members, teamVotes, feedback, winner } = data;
  const a = accentFor(basket);
  const votesOf = (teamId: string) => teamVotes.filter((v) => v.team_id === teamId).length;

  return (
    <main className="mx-auto max-w-[880px] px-[clamp(24px,5vw,40px)] pb-20 pt-8" data-testid="result-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/archive" className="text-[0.9rem]" style={{ color: "var(--text-muted)" }}>
          ← Arşiv
        </Link>
        <button
          type="button"
          onClick={() => void downloadCsv()}
          className="rounded-full px-4 py-2 text-[0.85rem] font-semibold"
          style={{ background: soft(a, 0.18), color: a.base }}
          data-testid="result-csv"
        >
          CSV indir
        </button>
      </div>

      <p className="mt-8 text-[0.72rem] font-bold uppercase tracking-[0.22em]" style={{ color: a.base }}>
        Sonuç · {basket.type}
      </p>
      <h1 className="font-display mt-2 text-[clamp(2rem,4vw,3.2rem)] font-bold" style={{ color: "var(--text)" }}>
        {basket.title}
      </h1>
      <p className="mt-2 text-[0.9rem]" style={{ color: "var(--text-muted)" }} data-testid="result-date">
        {new Date(basket.created_at).toLocaleString("tr-TR")}
        {basket.hackathon_ends_at
          ? ` · bitti ${new Date(basket.hackathon_ends_at).toLocaleString("tr-TR")}`
          : null}
      </p>

      <section
        className="mt-8 rounded-[22px] p-6"
        style={{ background: "#0F0F0F", border: `1px solid ${soft(a, 0.35)}` }}
        data-testid="result-winner"
      >
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.25em]" style={{ color: a.base }}>
          Kazanan
        </p>
        <p className="font-display mt-2 text-[clamp(1.6rem,3vw,2.4rem)] font-bold" style={{ color: a.base }}>
          {winner?.text ?? "—"}
        </p>
        {winner?.vote_count != null && (
          <p className="mt-1 tnum text-[0.95rem]" style={{ color: "var(--text-muted)" }}>
            {winner.vote_count} oy
          </p>
        )}
      </section>

      <section className="mt-8" data-testid="result-ideas">
        <h2 className="text-[0.75rem] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
          Fikirler & oylar
        </h2>
        <div className="mt-3 flex flex-col gap-2">
          {ideas.map((idea) => {
            const ideaVoters = votes.filter((v) => v.idea_id === idea.id).map((v) => v.voter);
            return (
              <div
                key={idea.id}
                className="flex items-center justify-between gap-3 rounded-xl px-4 py-3"
                style={{ background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.08)" }}
              >
                <div>
                  <span style={{ color: "var(--text)" }}>{idea.text}</span>
                  {data.canViewVotes && ideaVoters.length > 0 && (
                    <p className="mt-1 text-[0.78rem]" style={{ color: "var(--text-faint)" }} data-testid={`voters-${idea.id}`}>
                      Oy verenler: {ideaVoters.join(", ")}
                    </p>
                  )}
                </div>
                <span className="tnum font-bold" style={{ color: a.base }}>
                  {idea.vote_count}
                </span>
              </div>
            );
          })}
        </div>
        {!data.canViewVotes && (
          <p className="mt-2 text-[0.75rem]" style={{ color: "var(--text-faint)" }} data-testid="votes-masked">
            Oy verenler gizli · vote.view_all gerekir
          </p>
        )}
        <p className="mt-2 text-[0.8rem]" style={{ color: "var(--text-faint)" }} data-testid="result-vote-count">
          {votes.length} oy kaydı
        </p>
      </section>

      {participants.length > 0 && (
        <section className="mt-8" data-testid="result-participants">
          <h2 className="text-[0.75rem] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
            Katılımcılar ({participants.length})
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {participants.map((p) => (
              <li
                key={p.id}
                className="rounded-full px-3 py-1.5 text-[0.85rem]"
                style={{ background: "var(--card)", color: "var(--text)" }}
              >
                {p.display_name || p.email || p.user_id}
              </li>
            ))}
          </ul>
        </section>
      )}

      {teams.length > 0 && (
        <section className="mt-8" data-testid="result-teams">
          <h2 className="text-[0.75rem] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
            Takımlar
          </h2>
          <div className="mt-3 flex flex-col gap-2">
            {[...teams]
              .sort((x, y) => votesOf(y.id) - votesOf(x.id))
              .map((t, i) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-xl px-4 py-3"
                  style={{ background: "var(--card)" }}
                >
                  <span style={{ color: "var(--text)" }}>
                    {i + 1}. {t.name}
                    <span className="ml-2 text-[0.8rem]" style={{ color: "var(--text-faint)" }}>
                      {members.filter((m) => m.team_id === t.id).length} kişi
                    </span>
                    {(t.idea_id || basket.selected_idea_id) && (
                      <span className="mt-1 block text-[0.85rem]" style={{ color: "var(--text-2)" }} data-testid="result-team-idea">
                        Fikir:{" "}
                        {ideas.find((idea) => idea.id === (t.idea_id ?? basket.selected_idea_id))?.text ??
                          "—"}
                        {t.angle ? ` · açı: ${t.angle}` : ""}
                      </span>
                    )}
                  </span>
                  <span className="tnum font-bold" style={{ color: a.base }}>
                    {votesOf(t.id)} oy
                  </span>
                </div>
              ))}
          </div>
        </section>
      )}

      {feedback.length > 0 && (
        <section className="mt-8" data-testid="result-feedback">
          <h2 className="text-[0.75rem] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
            Feedback
          </h2>
          <div className="mt-3 flex flex-col gap-2">
            {feedback.map((f) => (
              <div key={f.id} className="rounded-xl px-4 py-3" style={{ background: "var(--card)" }}>
                <p style={{ color: "var(--text)" }}>{f.text}</p>
                <p className="mt-1 text-[0.78rem]" style={{ color: "var(--text-faint)" }}>
                  {f.author_name || f.author_id}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

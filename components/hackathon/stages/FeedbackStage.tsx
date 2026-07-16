"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { addFeedback, listFeedback } from "@/lib/hackathon";
import { groupFeedbackByTeam } from "@/lib/feedback-groups";
import { supabase } from "@/lib/supabase";
import type { Feedback } from "@/lib/types";
import type { StageContext } from "../contract";
import { dim } from "../contract";
import { Card, GoldButton, StageHeadline, initials } from "../ui";

export function FeedbackStage({ data, user }: StageContext) {
  const { basket, teams, members, ideas } = data;
  const [items, setItems] = useState<Feedback[]>([]);
  const [draft, setDraft] = useState("");
  const [teamId, setTeamId] = useState<string>("");

  const myTeamId = useMemo(() => {
    const m = members.find((x) => x.user_id === user.email || x.user_id === user.id);
    return m?.team_id ?? null;
  }, [members, user.email, user.id]);

  useEffect(() => {
    if (myTeamId) setTeamId(myTeamId);
    else if (teams[0]) setTeamId(teams[0].id);
  }, [myTeamId, teams]);

  const load = useCallback(() => {
    listFeedback(basket.id).then(setItems);
  }, [basket.id]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`fb:${basket.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "feedback", filter: `basket_id=eq.${basket.id}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [basket.id, load]);

  const teamNames = useMemo(() => {
    const m: Record<string, string> = {};
    for (const t of teams) m[t.id] = t.name;
    return m;
  }, [teams]);

  const groups = useMemo(
    () => groupFeedbackByTeam(items, teamNames),
    [items, teamNames]
  );

  const ideaForTeam = (tid: string | null) => {
    if (!tid) return null;
    const t = teams.find((x) => x.id === tid);
    const ideaId = t?.idea_id ?? basket.selected_idea_id;
    return ideas.find((i) => i.id === ideaId) ?? null;
  };

  const submit = async () => {
    const t = draft.trim();
    if (t.length < 2) return;
    const selectedTeam = teams.find((x) => x.id === teamId) ?? null;
    const ideaId =
      selectedTeam?.idea_id ?? basket.selected_idea_id ?? basket.winner_idea_id ?? null;
    await addFeedback({
      basket_id: basket.id,
      tenant_id: basket.tenant_id,
      team_id: teamId || null,
      idea_id: ideaId,
      author_id: user.email,
      author_name: user.name,
      text: t,
    });
    setDraft("");
    load();
  };

  return (
    <div className="mx-auto max-w-[720px]" data-testid="feedback-stage">
      <StageHeadline
        pre="Ne"
        accent="eksik"
        post="?"
        sub="Yorumunu bir projeye / takıma bağla — takımlar kendi feedback'ini toplu görür."
      />

      <Card>
        {teams.length > 0 && (
          <label className="mb-3 block text-left">
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.2em]" style={{ color: dim(0.45) }}>
              Proje / takım
            </span>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="mt-1.5 w-full rounded-xl px-3 py-2.5 text-[0.95rem]"
              style={{
                background: "var(--surface-2)",
                color: "var(--text)",
                border: "1px solid rgba(var(--border-rgb),0.09)",
              }}
              data-testid="feedback-team-select"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {ideaForTeam(t.id) ? ` — ${ideaForTeam(t.id)!.text.slice(0, 40)}` : ""}
                </option>
              ))}
              <option value="">Genel (takımsız)</option>
            </select>
          </label>
        )}
        <div className="flex gap-2.5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void submit()}
            placeholder="Bu projeye özel yorum…"
            className="flex-1 rounded-xl px-4 py-3 text-[1rem] outline-none"
            style={{
              background: "var(--surface-2)",
              border: "1px solid rgba(var(--border-rgb),0.09)",
              color: "var(--text)",
            }}
            data-testid="feedback-draft"
          />
          <GoldButton onClick={() => void submit()} disabled={draft.trim().length < 2}>
            Gönder
          </GoldButton>
        </div>
      </Card>

      <div className="mt-5 flex flex-col gap-5" data-testid="feedback-grouped">
        {groups.map((g) => (
          <div key={g.key} data-testid={`feedback-group-${g.key}`}>
            <h3
              className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.2em]"
              style={{ color: dim(0.45) }}
            >
              {g.label}
              {ideaForTeam(g.teamId) && (
                <span className="ml-2 normal-case tracking-normal" style={{ color: dim(0.35) }}>
                  · {ideaForTeam(g.teamId)!.text.slice(0, 48)}
                </span>
              )}
            </h3>
            <div className="flex flex-col gap-2.5">
              {g.items.map((f) => (
                <div
                  key={f.id}
                  className="flex gap-3 rounded-2xl px-4 py-3"
                  style={{
                    background: "var(--card)",
                    border: "1px solid rgba(var(--border-rgb),0.08)",
                  }}
                >
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[0.8rem] font-bold"
                    style={{ background: "var(--surface-2)", color: "var(--text)" }}
                  >
                    {initials(f.author_name || f.author_id || "?")}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[0.8rem]" style={{ color: dim(0.5) }}>
                      {f.author_name || f.author_id}
                    </p>
                    <p className="text-[0.98rem]" style={{ color: "var(--text)" }}>
                      {f.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {!items.length && (
          <p className="py-8 text-center text-[0.9rem]" style={{ color: dim(0.4) }}>
            İlk yorumu sen yaz.
          </p>
        )}
      </div>
    </div>
  );
}

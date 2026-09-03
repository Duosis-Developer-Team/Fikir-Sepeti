"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { addFeedback, listFeedback, setTeamTurn } from "@/lib/hackathon";
import { groupFeedbackByTeam } from "@/lib/feedback-groups";
import { feedbackTurnProgress, nextTurnEndsAt, requiredReviewers, teamAtTurn, teamOrder } from "@/lib/teamTurn";
import { subscribeChanges } from "@/lib/realtime";
import type { Feedback } from "@/lib/types";
import type { StageContext } from "../contract";
import { dim } from "../contract";
import { TeamTurnBar } from "../TeamTurnBar";
import { Card, GoldButton, StageHeadline, initials } from "../ui";

export function FeedbackStage({ data, config, user, isAdmin, refresh, readOnly }: StageContext) {
  const { basket, teams, members, participants, ideas } = data;
  const [items, setItems] = useState<Feedback[]>([]);
  const [draft, setDraft] = useState("");

  const load = useCallback(() => {
    listFeedback(basket.id).then(setItems);
  }, [basket.id]);

  useEffect(() => {
    load();
    return subscribeChanges({
      filters: [{ table: "feedback", column: "basket_id", value: basket.id }],
      onChange: () => load(),
    });
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

  // Takımlar sırayla gelir — aynı puanlama turu mantığı burada da geçerli
  // (bkz. talep: "aynı şey sıra sıra takım mantığını ne eksik var kısmına da yap").
  const order = teamOrder(teams);
  const idx = Math.min(basket.team_turn_idx ?? 0, Math.max(0, order.length - 1));
  const currentTeam = teamAtTurn(teams, idx);
  const reviewers = currentTeam ? requiredReviewers(participants, members, currentTeam.id) : [];
  const progress = currentTeam
    ? feedbackTurnProgress({ team: currentTeam, reviewers, feedback: items })
    : { done: 0, total: 0, complete: false };

  const advanceTurn = () => {
    const nextIdx = Math.min(idx + 1, order.length - 1);
    void setTeamTurn(basket.id, nextIdx, nextTurnEndsAt(config.teamTurnMinutes)).then(refresh);
  };

  const submit = async () => {
    if (readOnly) return;
    const t = draft.trim();
    if (t.length < 2) return;
    const ideaId =
      currentTeam?.idea_id ?? basket.selected_idea_id ?? basket.winner_idea_id ?? null;
    await addFeedback({
      basket_id: basket.id,
      tenant_id: basket.tenant_id,
      team_id: currentTeam?.id ?? null,
      idea_id: ideaId,
      author_id: user.email,
      author_name: user.name,
      text: t,
    });
    setDraft("");
    load();
  };

  const currentGroupItems = currentTeam
    ? items.filter((f) => f.team_id === currentTeam.id)
    : items.filter((f) => !f.team_id);

  return (
    <div className="mx-auto max-w-[720px]" data-testid="feedback-stage">
      <StageHeadline
        pre="Ne"
        accent="eksik"
        post="?"
        sub={order.length > 0 ? "Takımlar sırayla geliyor — yorumunu o takıma bırak." : "Yorumunu bırak."}
      />

      {order.length > 0 && currentTeam && (
        <div className="mt-6">
          <TeamTurnBar
            teamName={currentTeam.name}
            idx={idx}
            teamCount={order.length}
            endsAt={basket.team_turn_ends_at}
            reviewDone={progress.done}
            reviewTotal={progress.total}
            complete={progress.complete}
            isAdmin={isAdmin}
            readOnly={!!readOnly}
            onAdvance={advanceTurn}
          />
        </div>
      )}

      <Card>
        {currentTeam && ideaForTeam(currentTeam.id) && (
          <p className="mb-3 text-[0.85rem]" style={{ color: dim(0.5) }}>
            {currentTeam.name} — {ideaForTeam(currentTeam.id)!.text.slice(0, 60)}
          </p>
        )}
        <div className="flex gap-2.5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void submit()}
            placeholder={currentTeam ? `${currentTeam.name} için yorum…` : "Bu projeye özel yorum…"}
            disabled={readOnly}
            className="flex-1 rounded-xl px-4 py-3 text-[1rem] outline-none disabled:opacity-50"
            style={{
              background: "var(--surface-2)",
              border: "1px solid rgba(var(--border-rgb),0.09)",
              color: "var(--text)",
            }}
            data-testid="feedback-draft"
          />
          <GoldButton onClick={() => void submit()} disabled={readOnly || draft.trim().length < 2}>
            Gönder
          </GoldButton>
        </div>
      </Card>

      {order.length > 0 && currentTeam ? (
        <div className="mt-5 flex flex-col gap-2.5" data-testid="feedback-current-team">
          {currentGroupItems.map((f) => <FeedbackItem key={f.id} f={f} />)}
          {!currentGroupItems.length && (
            <p className="py-6 text-center text-[0.9rem]" style={{ color: dim(0.4) }}>
              {currentTeam.name} için henüz yorum yok — ilkini sen yaz.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-5" data-testid="feedback-grouped">
          {groups.map((g) => (
            <div key={g.key} data-testid={`feedback-group-${g.key}`}>
              <h3 className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.2em]" style={{ color: dim(0.45) }}>
                {g.label}
              </h3>
              <div className="flex flex-col gap-2.5">
                {g.items.map((f) => <FeedbackItem key={f.id} f={f} />)}
              </div>
            </div>
          ))}
          {!items.length && (
            <p className="py-8 text-center text-[0.9rem]" style={{ color: dim(0.4) }}>
              İlk yorumu sen yaz.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function FeedbackItem({ f }: { f: Feedback }) {
  return (
    <div
      className="flex gap-3 rounded-2xl px-4 py-3"
      style={{ background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.08)" }}
    >
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[0.8rem] font-bold"
        style={{ background: "var(--surface-2)", color: "var(--text)" }}
      >
        {initials(f.author_name || f.author_id || "?")}
      </span>
      <div className="min-w-0">
        <p className="text-[0.8rem]" style={{ color: dim(0.5) }}>{f.author_name || f.author_id}</p>
        <p className="text-[0.98rem]" style={{ color: "var(--text)" }}>{f.text}</p>
      </div>
    </div>
  );
}

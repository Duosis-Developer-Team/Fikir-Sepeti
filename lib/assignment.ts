import type { Idea, Team, TeamMember } from "./types";

export type TeamIdeaPair = { teamId: string; ideaId: string };

/** Fisher–Yates shuffle (mutates a copy). */
export function shuffleInPlace<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Pick up to `count` distinct ideas at random (winner locked before animation). */
export function pickRandomIdeas(ideas: Idea[], count: number): Idea[] {
  if (count <= 0 || !ideas.length) return [];
  const n = Math.min(count, ideas.length);
  return shuffleInPlace(ideas).slice(0, n);
}

/**
 * same — idea creator's team builds that idea when possible;
 * leftover teams get leftover ideas; single idea → all teams share it.
 */
export function assignSame(args: {
  teams: Team[];
  members: TeamMember[];
  ideas: Idea[];
  selectedIdeaId: string | null;
}): TeamIdeaPair[] {
  const { teams, members, ideas, selectedIdeaId } = args;
  if (!teams.length || !ideas.length) return [];

  if (ideas.length === 1 || (selectedIdeaId && ideas.length === 1)) {
    const ideaId = selectedIdeaId ?? ideas[0].id;
    return teams.map((t) => ({ teamId: t.id, ideaId }));
  }

  const pool = selectedIdeaId
    ? [
        ideas.find((i) => i.id === selectedIdeaId),
        ...ideas.filter((i) => i.id !== selectedIdeaId),
      ].filter(Boolean) as Idea[]
    : [...ideas];

  const usedIdeas = new Set<string>();
  const pairs: TeamIdeaPair[] = [];
  const remainingTeams = [...teams];

  for (const idea of pool) {
    if (!idea.created_by) continue;
    const mem = members.find((m) => m.user_id === idea.created_by);
    if (!mem) continue;
    const ti = remainingTeams.findIndex((t) => t.id === mem.team_id);
    if (ti < 0) continue;
    const [team] = remainingTeams.splice(ti, 1);
    pairs.push({ teamId: team.id, ideaId: idea.id });
    usedIdeas.add(idea.id);
  }

  const leftIdeas = pool.filter((i) => !usedIdeas.has(i.id));
  const shuffledIdeas = shuffleInPlace(leftIdeas);
  remainingTeams.forEach((team, i) => {
    const idea = shuffledIdeas[i % Math.max(1, shuffledIdeas.length)] ?? pool[0];
    if (idea) pairs.push({ teamId: team.id, ideaId: idea.id });
  });

  return pairs;
}

/**
 * cross — no team keeps its member's own idea when avoidable;
 * permute ideas across teams.
 */
export function assignCross(args: {
  teams: Team[];
  members: TeamMember[];
  ideas: Idea[];
}): TeamIdeaPair[] {
  const { teams, members, ideas } = args;
  if (!teams.length || !ideas.length) return [];

  const ideaPool =
    ideas.length >= teams.length
      ? shuffleInPlace(ideas).slice(0, teams.length)
      : shuffleInPlace([
          ...ideas,
          ...Array.from({ length: teams.length - ideas.length }, (_, i) => ideas[i % ideas.length]),
        ]);

  // Try a few shuffles to avoid "author's team gets own idea"
  for (let attempt = 0; attempt < 12; attempt++) {
    const order = shuffleInPlace(ideaPool);
    const pairs = teams.map((t, i) => ({
      teamId: t.id,
      ideaId: order[i % order.length].id,
    }));
    const conflict = pairs.some((p) => {
      const idea = ideas.find((i) => i.id === p.ideaId);
      if (!idea?.created_by) return false;
      return members.some((m) => m.team_id === p.teamId && m.user_id === idea.created_by);
    });
    if (!conflict || attempt === 11) return pairs;
  }
  return teams.map((t, i) => ({
    teamId: t.id,
    ideaId: ideaPool[i % ideaPool.length].id,
  }));
}

/** Labels for raffle stage (team name · idea text). */
export function pairLabels(
  pairs: TeamIdeaPair[],
  teams: Team[],
  ideas: Idea[]
): { label: string; pair: TeamIdeaPair }[] {
  return pairs.map((p) => {
    const team = teams.find((t) => t.id === p.teamId);
    const idea = ideas.find((i) => i.id === p.ideaId);
    return {
      pair: p,
      label: `${team?.name ?? "Takım"} ← ${idea?.text ?? "?"}`,
    };
  });
}

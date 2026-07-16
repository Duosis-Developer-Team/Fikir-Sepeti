import type { Feedback } from "./types";

export type FeedbackGroup<T extends { team_id?: string | null } = Feedback> = {
  key: string;
  teamId: string | null;
  label: string;
  items: T[];
};

/** Group feedback by team_id; null team → "Genel". */
export function groupFeedbackByTeam<T extends { team_id?: string | null; created_at?: string }>(
  items: T[],
  teamNames: Record<string, string> = {}
): FeedbackGroup<T>[] {
  const map = new Map<string, FeedbackGroup<T>>();
  for (const item of items) {
    const teamId = item.team_id ?? null;
    const key = teamId ?? "__general__";
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        teamId,
        label: teamId ? teamNames[teamId] || "Takım" : "Genel",
        items: [],
      };
      map.set(key, g);
    }
    g.items.push(item);
  }
  const groups = [...map.values()];
  groups.sort((a, b) => {
    if (a.teamId == null) return 1;
    if (b.teamId == null) return -1;
    return a.label.localeCompare(b.label, "tr");
  });
  return groups;
}

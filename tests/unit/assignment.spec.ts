import { test, expect } from "@playwright/test";
import {
  assignCross,
  assignSame,
  pickRandomIdeas,
  shuffleInPlace,
} from "../../lib/assignment";
import type { Idea, Team, TeamMember } from "../../lib/types";

const idea = (id: string, created_by: string, text = id): Idea =>
  ({
    id,
    basket_id: "b",
    text,
    tag: null,
    is_finalist: false,
    demo_url: null,
    presenter: null,
    live_at: null,
    created_by,
    vote_count: 0,
    created_at: "",
  }) as Idea;

const team = (id: string, name: string): Team => ({
  id,
  basket_id: "b",
  name,
  created_at: "",
});

const mem = (team_id: string, user_id: string): TeamMember => ({
  id: `${team_id}-${user_id}`,
  team_id,
  basket_id: "b",
  user_id,
});

test.describe("S6 assignment helpers", () => {
  test("pickRandomIdeas respects count and uniqueness", () => {
    const ideas = [idea("a", "u1"), idea("b", "u2"), idea("c", "u3")];
    const picks = pickRandomIdeas(ideas, 2);
    expect(picks).toHaveLength(2);
    expect(new Set(picks.map((p) => p.id)).size).toBe(2);
    expect(pickRandomIdeas(ideas, 10)).toHaveLength(3);
  });

  test("assignSame single idea → all teams share it", () => {
    const teams = [team("t1", "A"), team("t2", "B")];
    const ideas = [idea("i1", "u1", "Pizza")];
    const pairs = assignSame({
      teams,
      members: [mem("t1", "u1")],
      ideas,
      selectedIdeaId: "i1",
    });
    expect(pairs.every((p) => p.ideaId === "i1")).toBe(true);
    expect(pairs).toHaveLength(2);
  });

  test("assignCross yields one idea per team", () => {
    const teams = [team("t1", "A"), team("t2", "B"), team("t3", "C")];
    const ideas = [idea("i1", "u1", "A"), idea("i2", "u2", "B"), idea("i3", "u3", "C")];
    const members = [mem("t1", "u1"), mem("t2", "u2"), mem("t3", "u3")];
    const pairs = assignCross({ teams, members, ideas });
    expect(pairs).toHaveLength(3);
    expect(new Set(pairs.map((p) => p.teamId)).size).toBe(3);
  });

  test("shuffleInPlace returns same length", () => {
    expect(shuffleInPlace([1, 2, 3])).toHaveLength(3);
  });
});

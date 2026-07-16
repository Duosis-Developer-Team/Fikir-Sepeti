import { test, expect } from "@playwright/test";
import { decideLobbyJoin, ideaStatusLabel } from "../../lib/lobby";

test.describe("S11 lobby helpers", () => {
  test("open lobby allows members approved", () => {
    const d = decideLobbyJoin({
      basket: {
        phase: "lobby",
        lobby_locked: false,
        status: "active",
        config: { lobbyPolicy: "open" },
      },
      isOwner: false,
    });
    expect(d).toEqual({ ok: true, approved: true });
  });

  test("approval policy → pending", () => {
    const d = decideLobbyJoin({
      basket: {
        phase: "lobby",
        lobby_locked: false,
        status: "active",
        config: { lobbyPolicy: "approval" },
      },
      isOwner: false,
    });
    expect(d).toEqual({ ok: true, approved: false });
  });

  test("locked phase blocks without late join", () => {
    const d = decideLobbyJoin({
      basket: {
        phase: "idea",
        lobby_locked: true,
        status: "active",
        config: {},
      },
      isOwner: false,
    });
    expect(d.ok).toBe(false);
  });

  test("allowLateJoin opens started basket", () => {
    const d = decideLobbyJoin({
      basket: {
        phase: "hackathon",
        lobby_locked: true,
        status: "active",
        config: { allowLateJoin: true },
      },
      isOwner: false,
    });
    expect(d.ok).toBe(true);
  });

  test("idea status labels", () => {
    expect(ideaStatusLabel({ ideaSource: "pool" })).toMatch(/birlikte/i);
    expect(ideaStatusLabel({ ideaSource: "static" })).toMatch(/belli/i);
  });
});

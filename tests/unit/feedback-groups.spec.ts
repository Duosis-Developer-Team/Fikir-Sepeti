import { test, expect } from "@playwright/test";
import { groupFeedbackByTeam } from "../../lib/feedback-groups";

test.describe("S10 feedback grouping", () => {
  test("groups by team_id with Genel bucket", () => {
    const groups = groupFeedbackByTeam(
      [
        { id: "1", team_id: "t1", text: "a", created_at: "2026-01-01" },
        { id: "2", team_id: "t1", text: "b", created_at: "2026-01-02" },
        { id: "3", team_id: null, text: "c", created_at: "2026-01-03" },
        { id: "4", team_id: "t2", text: "d", created_at: "2026-01-04" },
      ],
      { t1: "Squad Alpha", t2: "Squad Beta" }
    );
    expect(groups).toHaveLength(3);
    expect(groups.find((g) => g.teamId === "t1")?.label).toBe("Squad Alpha");
    expect(groups.find((g) => g.teamId === "t1")?.items).toHaveLength(2);
    expect(groups.find((g) => g.teamId == null)?.label).toBe("Genel");
  });
});

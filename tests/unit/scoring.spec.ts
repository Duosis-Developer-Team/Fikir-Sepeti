import { test, expect } from "@playwright/test";
import { computeTeamScores, DEFAULT_RUBRIC } from "../../lib/scoring";

test.describe("S7 weighted scoring", () => {
  test("equal stars → equal weighted total across default rubric", () => {
    const teamIds = ["t1"];
    const scores = DEFAULT_RUBRIC.map((c) => ({
      team_id: "t1",
      voter: "a@duosis.dev",
      category_key: c.key,
      stars: 4,
      is_jury: false,
    }));
    const [row] = computeTeamScores({ teamIds, scores, rubric: DEFAULT_RUBRIC });
    expect(row.total).toBeCloseTo(4, 5);
    expect(row.categories.every((c) => c.avgStars === 4)).toBe(true);
  });

  test("jury weight doubles jury votes in average", () => {
    const rubric = [{ key: "ui", label: "UI", weight: 1 }];
    const scores = [
      { team_id: "t1", voter: "member", category_key: "ui", stars: 2, is_jury: false },
      { team_id: "t1", voter: "jury", category_key: "ui", stars: 5, is_jury: true },
    ];
    // weight: member 2*1 + jury 5*2 = 12; weightAcc 1+2=3 → avg 4
    const [row] = computeTeamScores({
      teamIds: ["t1"],
      scores,
      rubric,
      juryEnabled: true,
      juryWeight: 2,
    });
    expect(row.categories[0].avgStars).toBeCloseTo(4, 5);
    expect(row.total).toBeCloseTo(4, 5);
  });

  test("category weights affect total", () => {
    const rubric = [
      { key: "a", label: "A", weight: 1 },
      { key: "b", label: "B", weight: 3 },
    ];
    const scores = [
      { team_id: "t1", voter: "x", category_key: "a", stars: 5, is_jury: false },
      { team_id: "t1", voter: "x", category_key: "b", stars: 1, is_jury: false },
    ];
    // (5*1 + 1*3) / 4 = 2
    const [row] = computeTeamScores({ teamIds: ["t1"], scores, rubric });
    expect(row.total).toBeCloseTo(2, 5);
  });
});

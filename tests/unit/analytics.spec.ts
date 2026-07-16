import { test, expect } from "@playwright/test";
import {
  buildFunnel,
  computeRetention3Month,
  teaserParticipationPct,
} from "../../lib/analytics";

test.describe("S8 analytics pure helpers", () => {
  test("buildFunnel rates from start and prev", () => {
    const stages = buildFunnel({
      ideas: 100,
      voted: 40,
      organized: 10,
      done: 5,
      production: 2,
    });
    expect(stages).toHaveLength(5);
    expect(stages[0].rateFromPrev).toBeNull();
    expect(stages[1].rateFromPrev).toBe(40);
    expect(stages[1].rateFromStart).toBe(40);
    expect(stages[4].count).toBe(2);
    expect(stages[4].rateFromStart).toBe(2);
  });

  test("computeRetention3Month — sustained share", () => {
    const asOf = new Date(Date.UTC(2026, 6, 15)); // July 2026
    // Anchor = May 2026 (−2 months)
    const events = [
      { userKey: "a", at: new Date(Date.UTC(2026, 4, 2)) }, // May
      { userKey: "b", at: new Date(Date.UTC(2026, 4, 10)) },
      { userKey: "c", at: new Date(Date.UTC(2026, 4, 20)) },
      { userKey: "a", at: new Date(Date.UTC(2026, 6, 1)) }, // July — sustained
      { userKey: "b", at: new Date(Date.UTC(2026, 6, 5)) },
      { userKey: "d", at: new Date(Date.UTC(2026, 6, 8)) }, // new in July only
    ];
    const r = computeRetention3Month(events, asOf);
    expect(r.anchorMonth).toBe("2026-05");
    expect(r.asOfMonth).toBe("2026-07");
    expect(r.month1Active).toBe(3);
    expect(r.month3Active).toBe(2);
    expect(r.rate).toBeCloseTo(66.7, 0);
  });

  test("computeRetention3Month empty → 0", () => {
    const r = computeRetention3Month([], new Date(Date.UTC(2026, 0, 1)));
    expect(r.month1Active).toBe(0);
    expect(r.rate).toBe(0);
  });

  test("teaserParticipationPct averages last events", () => {
    const pct = teaserParticipationPct([
      { basketId: "1", participantCount: 8, capacityHint: 10 },
      { basketId: "2", participantCount: 5, capacityHint: 10 },
    ]);
    expect(pct).toBe(65);
  });
});

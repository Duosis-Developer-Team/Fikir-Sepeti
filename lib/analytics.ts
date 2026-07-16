/** Pure analytics helpers — funnel stages + 3-month retention (S8). */

export type FunnelStageKey =
  | "ideas"
  | "voted"
  | "organized"
  | "done"
  | "production";

export type FunnelStage = {
  key: FunnelStageKey;
  label: string;
  count: number;
  /** Conversion from previous stage (null for first). */
  rateFromPrev: number | null;
  /** Conversion from first stage. */
  rateFromStart: number | null;
};

export type ParticipationEvent = {
  userKey: string;
  at: Date;
};

export type RetentionResult = {
  /** Active users in anchor month (asOf − 2 months). */
  month1Active: number;
  /** Of month1, still active in asOf month. */
  month3Active: number;
  /** month3Active / month1Active, or 0 if none. */
  rate: number;
  anchorMonth: string;
  asOfMonth: string;
};

const STAGE_LABELS: Record<FunnelStageKey, string> = {
  ideas: "Fikir girildi",
  voted: "Oylandı / seçildi",
  organized: "Organizasyona dönüştü",
  done: "Yapıldı",
  production: "Üretime alındı",
};

function pct(num: number, den: number): number | null {
  if (den <= 0) return null;
  return Math.round((num / den) * 1000) / 10;
}

/** Build ordered funnel stages with conversion rates. */
export function buildFunnel(counts: Record<FunnelStageKey, number>): FunnelStage[] {
  const order: FunnelStageKey[] = [
    "ideas",
    "voted",
    "organized",
    "done",
    "production",
  ];
  const start = counts.ideas;
  let prev = start;
  return order.map((key, i) => {
    const count = counts[key] ?? 0;
    const stage: FunnelStage = {
      key,
      label: STAGE_LABELS[key],
      count,
      rateFromPrev: i === 0 ? null : pct(count, prev),
      rateFromStart: i === 0 ? null : pct(count, start),
    };
    prev = count;
    return stage;
  });
}

function monthKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function shiftMonth(d: Date, delta: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + delta, 1));
}

/**
 * 3-month sustained participation:
 * Of users active in (asOf − 2 months), what share were also active in asOf month.
 */
export function computeRetention3Month(
  events: ParticipationEvent[],
  asOf: Date = new Date()
): RetentionResult {
  const asOfM = monthKey(asOf);
  const anchor = shiftMonth(asOf, -2);
  const anchorM = monthKey(anchor);

  const byMonth = new Map<string, Set<string>>();
  for (const e of events) {
    const k = monthKey(e.at);
    let set = byMonth.get(k);
    if (!set) {
      set = new Set();
      byMonth.set(k, set);
    }
    set.add(e.userKey);
  }

  const m1 = byMonth.get(anchorM) ?? new Set();
  const m3 = byMonth.get(asOfM) ?? new Set();
  let still = 0;
  for (const u of m1) {
    if (m3.has(u)) still += 1;
  }

  return {
    month1Active: m1.size,
    month3Active: still,
    rate: m1.size === 0 ? 0 : Math.round((still / m1.size) * 1000) / 10,
    anchorMonth: anchorM,
    asOfMonth: asOfM,
  };
}

/** Average participation rate across last N resolved etkinlik baskets. */
export function teaserParticipationPct(
  events: { basketId: string; participantCount: number; capacityHint?: number }[]
): number | null {
  if (!events.length) return null;
  const rates = events.map((e) => {
    const den = e.capacityHint && e.capacityHint > 0 ? e.capacityHint : Math.max(e.participantCount, 1);
    return (e.participantCount / den) * 100;
  });
  const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
  return Math.round(avg * 10) / 10;
}

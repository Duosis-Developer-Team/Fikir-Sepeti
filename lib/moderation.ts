/** Content rule matching — pure helpers (S9). */

export type RuleAction = "warn" | "block";
export type RuleKind = "word" | "regex";

export type ContentRule = {
  id: string;
  pattern: string;
  kind: RuleKind;
  action: RuleAction;
  enabled?: boolean;
};

export type MatchHit = {
  ruleId: string;
  pattern: string;
  action: RuleAction;
  matched: string;
};

export type CheckResult = {
  ok: boolean;
  action: RuleAction | null;
  hits: MatchHit[];
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchRule(text: string, rule: ContentRule): string | null {
  const src = text.normalize("NFC");
  if (rule.kind === "regex") {
    try {
      const re = new RegExp(rule.pattern, "iu");
      const m = src.match(re);
      return m?.[0] ?? null;
    } catch {
      return null;
    }
  }
  // word: case-insensitive whole-word-ish (Turkish-aware fold via toLocaleLowerCase)
  const needle = rule.pattern.trim().toLocaleLowerCase("tr");
  if (!needle) return null;
  const hay = src.toLocaleLowerCase("tr");
  const re = new RegExp(`(?:^|[^\\p{L}\\p{N}_])${escapeRegExp(needle)}(?=$|[^\\p{L}\\p{N}_])`, "iu");
  const m = hay.match(re);
  if (m) return rule.pattern.trim();
  // also allow substring for short tokens without boundaries if no match
  if (hay.includes(needle)) return rule.pattern.trim();
  return null;
}

/** Evaluate text against enabled rules. block wins over warn. */
export function checkContent(
  text: string,
  rules: ContentRule[]
): CheckResult {
  const hits: MatchHit[] = [];
  for (const rule of rules) {
    if (rule.enabled === false) continue;
    const matched = matchRule(text, rule);
    if (!matched) continue;
    hits.push({
      ruleId: rule.id,
      pattern: rule.pattern,
      action: rule.action,
      matched,
    });
  }
  if (!hits.length) return { ok: true, action: null, hits: [] };
  const blocked = hits.some((h) => h.action === "block");
  return {
    ok: false,
    action: blocked ? "block" : "warn",
    hits,
  };
}

export function warnMessage(hits: MatchHit[]): string {
  const words = [...new Set(hits.map((h) => h.matched))].slice(0, 5);
  return `Metninde şu kelimeler geçiyor: ${words.join(", ")}. Göndermek istediğine emin misin?`;
}

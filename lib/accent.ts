// Onaylı tasarımın 4 renkli aksan sistemi — her sepete bir renk.
// build → altın; sosyal sepetler → id hash'iyle mercan/yeşil/mavi.

export type Accent = { base: string; light: string; rgb: string };

export const ACCENTS: Record<string, Accent> = {
  coral: { base: "#F2795F", light: "#F5A98F", rgb: "242,121,95" },
  gold: { base: "#E7A93F", light: "#EEC078", rgb: "231,169,63" },
  green: { base: "#33C293", light: "#6FD9B4", rgb: "51,194,147" },
  blue: { base: "#6B8CF0", light: "#8FA8F5", rgb: "107,140,240" },
};

const SOCIAL = [ACCENTS.coral, ACCENTS.green, ACCENTS.blue];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function accentFor(basket: { id: string; type: string }): Accent {
  if (basket.type === "hackathon") return ACCENTS.gold;
  return SOCIAL[hash(basket.id) % SOCIAL.length];
}

/** rgba("242,121,95", 0.14) → "rgba(242,121,95,0.14)" */
export function soft(a: Accent, alpha: number): string {
  return `rgba(${a.rgb},${alpha})`;
}

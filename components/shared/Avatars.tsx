"use client";

// Yığında pozisyona göre renk — komşular hep farklı, çeşitli görünür.
const AV = ["#F2795F", "#33C293", "#6B8CF0", "#E7A93F", "#A78BFA", "#F472B6"];

export function Avatars({
  names,
  max = 4,
  size = 26,
  ring = "var(--card)",
}: {
  names: string[];
  max?: number;
  size?: number;
  ring?: string;
}) {
  const uniq = [...new Set(names.filter(Boolean))];
  const shown = uniq.slice(0, max);
  const extra = uniq.length - shown.length;
  const S = { width: size, height: size, fontSize: size * 0.4 };
  return (
    <span className="inline-flex">
      {shown.map((n, i) => (
        <span
          key={n}
          className="flex items-center justify-center rounded-full font-bold"
          style={{
            ...S,
            background: AV[i % AV.length],
            color: "#0F0F0F",
            marginLeft: i === 0 ? 0 : -size * 0.31,
            border: `2px solid ${ring}`,
            zIndex: shown.length - i,
          }}
          title={n}
        >
          {n.charAt(0).toLocaleUpperCase("tr")}
        </span>
      ))}
      {extra > 0 && (
        <span
          className="flex items-center justify-center rounded-full font-bold"
          style={{
            ...S,
            marginLeft: -size * 0.31,
            background: "var(--surface-2)",
            border: `2px solid ${ring}`,
            color: "var(--text-3)",
          }}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}

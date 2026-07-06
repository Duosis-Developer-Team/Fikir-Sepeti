"use client";

const AV = ["#F2795F", "#33C293", "#6B8CF0", "#E7A93F"];

function color(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AV[h % AV.length];
}

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
            background: color(n),
            color: "#161616",
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
            background: "#323232",
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

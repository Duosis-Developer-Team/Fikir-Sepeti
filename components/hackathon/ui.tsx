"use client";

import { GOLD, dim } from "./contract";
import { avatarColor, initial } from "@/lib/avatar";

/** Renkli, kimlik-bazlı baş-harf avatarı — ana sayfayla aynı palet. */
export function Avatar({ name, size = 28, ring }: { name: string; size?: number; ring?: string }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-bold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: avatarColor(name),
        color: "#0F0F0F",
        border: ring ? `2px solid ${ring}` : undefined,
      }}
      title={name}
    >
      {initial(name)}
    </span>
  );
}

/** Segmented seçim — config için. */
export function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value?: T;
  options: { v: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {options.map((o) => {
        const on = value === o.v;
        return (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            className="rounded-2xl px-4 py-3 text-left transition"
            style={{
              background: on ? "rgba(231,169,63,0.12)" : "#2A2A2A",
              border: `1px solid ${on ? GOLD : "rgba(255,255,255,0.09)"}`,
              minWidth: 132,
            }}
          >
            <span className="block text-[0.98rem] font-semibold" style={{ color: on ? GOLD : "#EDEDED" }}>{o.label}</span>
            {o.hint && <span className="mt-0.5 block text-[0.78rem]" style={{ color: dim(0.5) }}>{o.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Ana sayfa hero ruhu — kocaman kendinden emin başlık + renkli aksan kelime. */
export function StageHeadline({
  pre,
  accent,
  post,
  sub,
  color = GOLD,
}: {
  pre?: string;
  accent: string;
  post?: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="mx-auto mb-10 max-w-[860px] text-center">
      <h2 className="font-display text-[clamp(2.4rem,4.6vw,3.8rem)] font-extrabold leading-[1.0] tracking-tight" style={{ color: "#EDEDED" }}>
        {pre ? `${pre} ` : ""}
        <span style={{ color }}>{accent}</span>
        {post ?? ""}
      </h2>
      {sub && (
        <p className="mx-auto mt-4 max-w-[520px] text-[1.08rem] leading-snug" style={{ color: dim(0.55) }}>
          {sub}
        </p>
      )}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-[0.72rem] font-semibold uppercase tracking-[0.22em]" style={{ color: dim(0.5) }}>{label}</span>
      {children}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[22px] p-6 ${className}`}
      style={{ background: "#242424", border: "1px solid rgba(255,255,255,0.09)" }}
    >
      {children}
    </div>
  );
}

export function GoldButton({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-full px-6 py-3 text-[0.95rem] font-semibold transition hover:opacity-90 disabled:opacity-30"
      style={{ background: GOLD, color: "#17150F" }}
    >
      {children}
    </button>
  );
}

export function initials(s: string) {
  return (s || "?").charAt(0).toLocaleUpperCase("tr");
}

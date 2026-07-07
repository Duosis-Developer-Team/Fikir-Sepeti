"use client";

import { GOLD, dim } from "./contract";

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

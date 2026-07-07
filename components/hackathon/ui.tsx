"use client";

import { motion } from "motion/react";
import { GOLD, dim } from "./contract";
import { avatarColor, initial } from "@/lib/avatar";

// premium, ölçülü easing — yumuşak, zıplamayan
const EASE = [0.22, 0.85, 0.25, 1] as const;

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
              background: on ? "rgba(231,169,63,0.12)" : "var(--surface-2)",
              border: `1px solid ${on ? GOLD : "rgba(var(--border-rgb),0.09)"}`,
              minWidth: 132,
            }}
          >
            <span className="block text-[0.98rem] font-semibold" style={{ color: on ? GOLD : "var(--text)" }}>{o.label}</span>
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
    <div className="mx-auto mb-11 max-w-[920px] text-center">
      <motion.h2
        initial={{ opacity: 0, y: 22, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.55, ease: EASE }}
        className="font-display text-[clamp(2.8rem,5.4vw,4.6rem)] font-extrabold leading-[0.98] tracking-tight"
        style={{ color: "var(--text)" }}
      >
        {pre ? `${pre} ` : ""}
        <span style={{ color }}>{accent}</span>
        {post ?? ""}
      </motion.h2>
      {sub && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.12 }}
          className="mx-auto mt-5 max-w-[540px] text-[1.12rem] leading-snug"
          style={{ color: dim(0.55) }}
        >
          {sub}
        </motion.p>
      )}
    </div>
  );
}

/** Şık sayı seçici — çirkin native spinner yerine −/+ . */
export function NumberStepper({
  value,
  min = 1,
  max = 99,
  onChange,
  label,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (n: number) => void;
  label?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {label && <span className="text-[0.72rem] font-semibold uppercase tracking-[0.2em]" style={{ color: dim(0.5) }}>{label}</span>}
      <div className="flex items-center justify-between rounded-2xl p-2" style={{ background: "var(--surface-2)", border: "1px solid rgba(var(--border-rgb),0.1)" }}>
        <StepBtn onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}>−</StepBtn>
        <span className="font-display text-[1.7rem] font-bold tabular-nums" style={{ color: "var(--text)" }}>{value}</span>
        <StepBtn onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}>+</StepBtn>
      </div>
    </div>
  );
}

function StepBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.88 }}
      onClick={onClick}
      disabled={disabled}
      className="grid h-10 w-10 place-items-center rounded-xl text-[1.4rem] font-bold leading-none transition hover:bg-[rgba(var(--border-rgb),0.05)] disabled:opacity-25"
      style={{ background: "var(--surface-2)", color: GOLD }}
    >
      {children}
    </motion.button>
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
      style={{ background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.09)" }}
    >
      {children}
    </div>
  );
}

export function GoldButton({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? undefined : { y: -2 }}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      transition={{ duration: 0.18, ease: EASE }}
      className="rounded-full px-7 py-3.5 text-[1rem] font-semibold hover:opacity-90 disabled:opacity-30"
      style={{ background: GOLD, color: "#17150F" }}
    >
      {children}
    </motion.button>
  );
}

export function initials(s: string) {
  return (s || "?").charAt(0).toLocaleUpperCase("tr");
}

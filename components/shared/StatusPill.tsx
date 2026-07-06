"use client";

export function StatusPill({
  live,
  label,
}: {
  live: boolean;
  label?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs text-[var(--text-muted)]">
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          live ? "bg-[var(--accent-social)]" : "bg-[var(--text-muted)]"
        }`}
        style={live ? { boxShadow: "0 0 0 3px rgba(29,158,117,0.18)" } : undefined}
      />
      {label ?? (live ? "canlı" : "bağlanıyor…")}
    </span>
  );
}

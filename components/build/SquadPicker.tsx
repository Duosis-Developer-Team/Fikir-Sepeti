"use client";

import { useEffect, useState } from "react";
import { addSquadMember, listSquad } from "@/lib/db";
import type { Idea } from "@/lib/types";

export function SquadPicker({
  basketId,
  winner,
  voter,
  onResolve,
}: {
  basketId: string;
  winner: Idea | null;
  voter: string;
  onResolve: () => void;
}) {
  const [members, setMembers] = useState<string[]>([]);
  const [name, setName] = useState("");

  const refresh = async () => setMembers(await listSquad(basketId));
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basketId]);

  const join = async (who: string) => {
    const clean = who.trim();
    if (clean.length < 2) return;
    await addSquadMember(basketId, clean);
    setName("");
    await refresh();
  };

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="rounded-[var(--radius)] border border-[var(--accent-build)] bg-[var(--accent-build-soft)] p-4 text-center">
        <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Kazanan proje</p>
        <p className="mt-1 text-lg font-medium" style={{ color: "var(--accent-build)" }}>
          {winner?.text ?? "—"}
        </p>
      </div>

      <div>
        <p className="text-sm font-medium">Squad&apos;a katıl</p>
        <p className="text-xs text-[var(--text-muted)]">Kim bu projede çalışmak istiyor?</p>
        <div className="mt-2 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && join(name)}
            placeholder="İsim"
            className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent-build)]"
          />
          <button
            onClick={() => join(voter)}
            className="shrink-0 rounded-lg px-3 py-2.5 text-sm font-medium text-white"
            style={{ background: "var(--accent-build)" }}
          >
            Ben varım
          </button>
        </div>
        {name.trim().length >= 2 && (
          <button onClick={() => join(name)} className="mt-2 text-xs text-[var(--accent-build)]">
            “{name.trim()}” ekle
          </button>
        )}
      </div>

      {members.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <span
              key={m}
              className="rounded-full px-3 py-1 text-sm"
              style={{ background: "var(--accent-build-soft)", color: "var(--accent-build)" }}
            >
              {m}
            </span>
          ))}
        </div>
      )}

      <button
        onClick={onResolve}
        className="w-full rounded-lg py-3 text-sm font-medium text-white"
        style={{ background: "var(--accent-build)" }}
      >
        Sonuçlandır
      </button>
    </div>
  );
}

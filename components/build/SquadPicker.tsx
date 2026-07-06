"use client";

import { useEffect, useState } from "react";
import { addSquadMember, listSquad } from "@/lib/db";
import { Avatars } from "@/components/shared/Avatars";
import { soft, type Accent } from "@/lib/accent";
import type { Idea } from "@/lib/types";

export function SquadPicker({
  basketId,
  winner,
  voter,
  accent,
  isOwner,
  owner,
  onResolve,
}: {
  basketId: string;
  winner: Idea | null;
  voter: string;
  accent: Accent;
  isOwner: boolean;
  owner: string;
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
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl p-5 text-center" style={{ background: soft(accent, 0.1), border: `1px solid ${soft(accent, 0.3)}` }}>
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em]" style={{ color: "#9A9A9A" }}>Kazanan proje</p>
        <p className="font-display mt-1 text-[1.6rem] font-semibold" style={{ color: accent.base }}>{winner?.text ?? "—"}</p>
      </div>

      <div>
        <p className="text-sm font-semibold" style={{ color: "#EDEDED" }}>Squad&apos;a katıl</p>
        <p className="text-[0.85rem]" style={{ color: "#9A9A9A" }}>Kim bu projede çalışmak istiyor?</p>
        <div className="mt-2 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && join(name)}
            placeholder="İsim"
            className="min-w-0 flex-1 rounded-[14px] px-[18px] py-[13px] text-sm outline-none"
            style={{ background: "#242424", border: "1px solid rgba(255,255,255,0.10)", color: "#EDEDED" }}
          />
          <button onClick={() => join(voter)} className="shrink-0 rounded-[14px] px-5 text-sm font-bold" style={{ background: accent.base, color: "#0F0F0F" }}>Ben varım</button>
        </div>
      </div>

      {members.length > 0 && (
        <div className="flex items-center gap-3">
          <Avatars names={members} max={8} />
          <span className="text-sm" style={{ color: "#9A9A9A" }}>{members.join(" · ")}</span>
        </div>
      )}

      {isOwner ? (
        <button onClick={onResolve} className="w-full rounded-full py-[17px] text-[1.02rem] font-bold transition hover:-translate-y-[2px]" style={{ background: accent.base, color: "#0F0F0F", boxShadow: `0 18px 44px -18px ${soft(accent, 0.85)}` }}>
          Sonuçlandır
        </button>
      ) : (
        <div className="w-full rounded-full py-[15px] text-center text-[0.92rem]" style={{ background: "#242424", border: "1px solid rgba(255,255,255,0.08)", color: "#9A9A9A" }}>
          Squad&apos;a katılabilirsin — sonucu <span className="font-semibold" style={{ color: "#EDEDED" }}>{owner}</span> açıklayacak.
        </div>
      )}
    </div>
  );
}

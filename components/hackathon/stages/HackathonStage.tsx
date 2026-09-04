"use client";

import { useEffect, useState } from "react";
import { patchBasket, setBasketPhase } from "@/lib/db";
import { extendedEndsAt, renameTeam } from "@/lib/hackathon";
import type { DurationUnit } from "@/lib/types";
import type { StageContext } from "../contract";
import { GOLD, dim } from "../contract";
import { Avatar, GoldButton, NumberStepper, Segmented, StageHeadline } from "../ui";

// Lobideki "Ne kadar sürecek" adımıyla aynı birim seti — tutarlı olsun.
const UNITS: { v: DurationUnit; label: string }[] = [
  { v: "hour", label: "Saat" },
  { v: "day", label: "Gün" },
  { v: "week", label: "Hafta" },
];

export function HackathonStage({ data, isAdmin, refresh, user }: StageContext) {
  const { basket, teams, members, participants } = data;
  const nameOf = (uid: string) => {
    const p = participants.find((x) => x.user_id === uid);
    return p?.display_name || p?.email || uid;
  };

  // Takım kurulduktan sonra bile isim değiştirilebilsin diye — hackathon başladığında
  // artık TeamStage'e dönmek gerekmiyor, aynı kontrol burada da var.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const saveRename = async () => {
    if (editingId) {
      await renameTeam(editingId, editName, basket.id);
      setEditingId(null);
      refresh();
    }
  };
  const endsAt = basket.hackathon_ends_at ? new Date(basket.hackathon_ends_at).getTime() : null;
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const remain = endsAt && now ? Math.max(0, endsAt - now) : 0;
  const sec = Math.floor(remain / 1000);
  const hh = Math.floor(sec / 3600);
  const mm = Math.floor((sec % 3600) / 60);
  const ss = sec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const over = endsAt !== null && now !== null && remain <= 0;

  const finish = () => setBasketPhase(basket.id, "demo").then(refresh);
  const back = () => setBasketPhase(basket.id, "team").then(refresh);
  // GEÇİCİ TEST BUTONU — test için süreyi beklemeden bitirir, iş bitince kaldır.
  const forceTimeUp = () =>
    patchBasket(basket.id, { hackathon_ends_at: new Date().toISOString() }).then(() => refresh());
  // Süre dolmuş olsa bile ekleyebilsin diye şimdiden başlar — dolmadıysa mevcut bitişe eklenir.
  // Hesaplama lib/hackathon.ts'te: Date.now() component gövdesinde olursa
  // react-hooks/purity hata veriyor (impure çağrı), düz fonksiyonda sorun değil.
  const [extendValue, setExtendValue] = useState(1);
  const [extendUnit, setExtendUnit] = useState<DurationUnit>("hour");
  const addTime = () => {
    void patchBasket(basket.id, {
      hackathon_ends_at: extendedEndsAt(basket.hackathon_ends_at, extendValue, extendUnit),
    }).then(() => refresh());
  };

  return (
    <div className="mx-auto flex min-h-[58vh] max-w-[960px] flex-col items-center justify-center text-center">
      <StageHeadline
        pre="Hackathon"
        accent="başladı"
        sub={over ? "Süre doldu — demoya geçin." : "Takımlar yapıyor. Kalan süre:"}
      />

      <div
        className="font-display font-extrabold tabular-nums tracking-tight"
        style={{ fontSize: "clamp(4rem,13vw,11rem)", lineHeight: 0.95, color: over ? "#F2795F" : GOLD, textShadow: over ? "none" : "0 0 60px rgba(231,169,63,0.25)" }}
      >
        {now === null ? "--:--:--" : `${pad(hh)}:${pad(mm)}:${pad(ss)}`}
      </div>

      {isAdmin && (
        <div className="mt-12 flex flex-col items-center gap-3">
          <div className="flex flex-wrap items-end justify-center gap-x-6 gap-y-3">
            <NumberStepper label="Süre ekle" value={extendValue} min={1} max={99} onChange={setExtendValue} />
            <Segmented label="Birim" value={extendUnit} onChange={setExtendUnit} options={UNITS} />
            <button
              onClick={addTime}
              className="rounded-full border px-5 py-2.5 text-[0.88rem] font-semibold transition hover:bg-[rgba(231,169,63,0.1)]"
              style={{ borderColor: "rgba(231,169,63,0.35)", color: GOLD }}
            >
              Ekle →
            </button>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button onClick={back} className="rounded-full border px-6 py-3 text-[0.95rem] transition hover:bg-[rgba(var(--border-rgb),0.08)]" style={{ borderColor: "rgba(var(--border-rgb),0.2)", color: dim(0.85) }}>← Takım</button>
            <GoldButton onClick={finish} disabled={!over}>Hackathon&apos;u bitir → Demo</GoldButton>
          </div>
          {!over && (
            <>
              <p className="text-[0.85rem]" style={{ color: dim(0.4) }}>Süre bitmeden bir sonraki aşamaya geçilemez.</p>
              {/* GEÇİCİ TEST BUTONU — kaldırılacak */}
              <button
                onClick={forceTimeUp}
                className="rounded-full border border-dashed px-4 py-2 text-[0.78rem] transition hover:opacity-80"
                style={{ borderColor: "rgba(var(--border-rgb),0.3)", color: dim(0.35) }}
              >
                🧪 (geçici · test) Süreyi hemen bitir
              </button>
            </>
          )}
        </div>
      )}
      {!isAdmin && <p className="mt-8 text-[0.95rem]" style={{ color: dim(0.45) }}>Sunan bitirince demoya geçilecek.</p>}

      {teams.length > 0 && (
        <div className="mt-12 grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((t) => {
            const mem = members.filter((m) => m.team_id === t.id);
            const isLeader = !!t.leader_user_id && (t.leader_user_id === user.email || t.leader_user_id === user.id);
            const canRenameThis = isAdmin || isLeader;
            return (
              <div
                key={t.id}
                className="rounded-[18px] p-4 text-left"
                style={{ background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.09)" }}
              >
                {canRenameThis && editingId === t.id ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={saveRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRename();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="font-display w-full rounded-lg px-2 py-1 text-[1.05rem] font-bold outline-none"
                    style={{ background: "var(--surface-2)", border: `1px solid ${GOLD}`, color: GOLD }}
                  />
                ) : (
                  <button
                    onClick={() => {
                      if (canRenameThis) {
                        setEditingId(t.id);
                        setEditName(t.name);
                      }
                    }}
                    className="group inline-flex items-center gap-1.5"
                    style={{ cursor: canRenameThis ? "text" : "default" }}
                  >
                    <span className="font-display text-[1.05rem] font-bold" style={{ color: GOLD }}>{t.name}</span>
                    {canRenameThis && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-0 transition-opacity group-hover:opacity-60" aria-hidden><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                    )}
                  </button>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {mem.map((m) => <Avatar key={m.id} name={nameOf(m.user_id)} size={26} ring="var(--card)" />)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

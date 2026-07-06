@AGENTS.md

# Fikir Sepeti

İç araç (yazılım şirketi, ~10-20 kişi). Ekip kararları: fikir at → **oy** ya da **kura**. İki mod: **sosyal** (nereye gidelim / ne yapalım) ve **build** (iç hackathon: fikir → finalist → demo → canlı oylama → presenter → squad). Realtime oylama omurga.

Stack: Next.js (App Router) · Supabase (Postgres + Realtime) · Motion (framer-motion) · Tailwind v4 · canvas-confetti · Vercel.

## Tasarım — ZORUNLU

Tüm UI **`DESIGN-SYSTEM.md`**'ye uyar. Yeni ekran/component eklerken önce onu oku. Renk/tipografi/motion oradan türetilir. Özet:
- Claude design: **koyu mod, nötr-sıcak gri zemin**, **clay `#D97757` (ana) + altın `#E3A857` (build)** aksan.
- ❌ Mor/yeşil/mavi ana aksan, ❌ soğuk mavi-gri zemin, ❌ boş çıplak ekran, ❌ hero alt alta.
- Renk tek yerden: `app/globals.css` token'ları. Değişirse `DESIGN-SYSTEM.md` tablosuyla senkron tut.

## Notlar
- Realtime primitifi: `lib/useRealtimeVotes.ts` (optimistic + reconnect + fallback polling).
- Demo verisi Supabase'de hazır (2 sosyal + 1 build voting). RLS kapalı (iç araç, demo).

# Fikir-Sepeti — Güncel Mimari (kod gerçekliği)

> Bu doküman **çalışan koddan** çıkarılmıştır (clone: `main` @ `60fcd2f`).
> Kaynak gerçeklik sırası: kod → Supabase şeması → `lib/types.ts` → `DESIGN-SYSTEM.md` → `CLAUDE.md`.
> `PLAN.md` yalnızca tarihsel bağlamdır ve güncel kodla **çelişir** (aşağıda "Plan vs Kod" bölümüne bakın).

## 1. Ürün özeti

Fikir-Sepeti, ~10-20 kişilik iç ekip için **fikir toplama + karar** aracıdır. Her karar bir **sepet** (basket) olarak modellenir ve iki tipten biridir:

- **`etkinlik`** (sosyal): "nereye gidelim / ne yapalım". Fikir eklenir, sonra **oy** ile en çok oyu alan seçilir ya da **kura** ile rastgele çekilir.
- **`hackathon`** (build): iç hackathon pipeline'ı. Lobi → fikir → takım → demo (canlı takım oylaması) → feedback → production/done.

Realtime oylama ürünün omurgasıdır.

## 2. Stack (package.json'dan doğrulanmış)

| Katman | Teknoloji | Sürüm |
|---|---|---|
| Framework | Next.js (App Router, **Turbopack**) | 16.2.10 |
| UI kütüphanesi | React / React DOM | 19.2.4 |
| Dil | TypeScript (`strict: true`) | ^5 |
| Backend | Supabase (Postgres + Realtime), `@supabase/supabase-js` | ^2.110 |
| Stil | Tailwind CSS v4 (`@tailwindcss/postcss`) | ^4 |
| Animasyon | `motion` (framer-motion) | ^12.42 |
| QR | `qrcode` | ^1.5 |
| Konfeti | `canvas-confetti` | ^1.9 — **paket var ama kullanılmıyor** (kod bloom gradient tercih ediyor) |
| Test | `playwright` (devDep) | ^1.61 — **config/test dosyası yok** |
| Deploy | Vercel (varsayım, README/CLAUDE notu) | — |

> ⚠️ **Next.js 16 uyarısı (`AGENTS.md`):** Bu, alışık olduğun Next.js değildir. App Router / API değişikliğinden önce `node_modules/next/dist/docs/` içindeki ilgili rehber okunmalı ve build ile doğrulanmalı.

## 3. Route yapısı (`app/`)

Tüm sayfa dosyaları **client component** (`"use client"`); tek server component `app/layout.tsx`. Dinamik route'lar Next 16'nın async `params` API'sini **kullanmaz** — hepsi `useParams()` ile senkron okur. Sonuç: **SSR / server-side data fetch yok**, her şey mount sonrası Supabase'den client tarafında çekilir.

| Route | Dosya | Ne yapar | Kimlik |
|---|---|---|---|
| `/` | `app/page.tsx` | Ana feed: hero, aktif/geçmiş sekmeleri, Featured kart + mini oy barları, yeni sepet modalı | `useNameContext().name` |
| `/basket/[id]` | `app/basket/[id]/page.tsx` | Sepet detayı — `basket.type === "hackathon"` ise `HackathonRunner`, değilse `SocialBasket` | `name` → `voter` |
| `/basket/[id]/present` | `app/basket/[id]/present/page.tsx` | Tam ekran presenter skorboard (altın tema) | `name \|\| "presenter"` |
| `/profil` | `app/profil/page.tsx` | Kullanıcının kendi sepetleri | `useNameContext().name` |

Prerender durumu (build çıktısı): `/`, `/profil`, `/_not-found` **statik**; `/basket/[id]` ve `/basket/[id]/present` **dinamik (ƒ)**.

`app/layout.tsx`: `lang="tr"`, Google fontları (`Bricolage_Grotesque` → `--font-display`, `Plus_Jakarta_Sans` → `--font-body`), ağaç `AuthGate` → `AppShell` ile sarılır. `AppShell` `/present` ve `/` üzerinde kendi header'ını gizler.

## 4. Kimlik / Auth (`components/AuthGate.tsx`)

- `SessionContext` sağlar: `{ user, ready, signOut }`, `SessionUser = { id, email, name }`.
- **`useNameContext()` geriye-dönük shim'dir:** `name = user?.email ?? ""`. Yani tüm uygulamada `voter` / `created_by` / `user_id` olarak kullanılan "isim" aslında **e-posta adresidir**.
- **Bypass modu** (`NEXT_PUBLIC_AUTH_BYPASS === "1"`): kimlik `localStorage` (`fikirsepeti:devuser`) üzerinden; giriş modalı serbest metin (isim veya e-posta; düz metin `<metin>@dev.local` olur). Microsoft butonu "yakında" placeholder'ı — **Azure bypass'ta devre dışı**.
- **Gerçek mod:** `supabase.auth.getSession()` + `onAuthStateChange`; `loginAzure()` → `supabase.auth.signInWithOAuth({ provider: "azure" })`. Azure OAuth **kodda bağlı** ama Supabase projesinde Azure provider'ın yapılandırılmış olmasına bağlı.
- **Not:** Rol/permission enforcement yok. "admin" tamamen `basket.created_by === user.email` karşılaştırmasıdır (client-side). RLS kapalı olduğu için bu güvenlik sınırı değil, yalnızca UI dallanması.

## 5. Veri katmanı (`lib/`)

| Dosya | Sorumluluk |
|---|---|
| `lib/supabase.ts` | Tek Supabase client. Env eksikse **modül yüklenirken hata fırlatır** (fail-fast; DEVELOPMENT_RULES §4 gereği bilinçli). |
| `lib/types.ts` | Domain tipleri — **şema ile senkron kaynak gerçeklik**. |
| `lib/db.ts` | Sepet/fikir/squad CRUD: `listBaskets`, `loadHome`, `createBasket`, `setBasketPhase`, `setCurrentDemoIdx`, `resolveBasket`, `addIdea`, `deleteIdea`, `setFinalists`, `updateDemo`, `addSquadMember`, `listSquad`. |
| `lib/hackathon.ts` | Hackathon: `joinLobby`, `listParticipants`, `markDone`, `setConfig`, `setSelectedIdea`, `listTeams`, `listTeamMembers`, `rebuildTeams`, `partition`, `listTeamVotes`, `voteTeam`, `addFeedback`, `listFeedback`. |
| `lib/useRealtimeVotes.ts` | ★ Merkezi realtime oylama primitifi (aşağıya bakın). |
| `lib/accent.ts` | 4 renkli aksan sistemi: hackathon → altın; sosyal → `id` hash'i ile coral/green/blue. `soft(a, alpha)` → `rgba()`. |
| `lib/name.ts` | Eski localStorage isim gate'i (`useName`). Artık AuthGate shim'i baskın; kısmen legacy. |

## 6. Realtime mimarisi

### Merkezi primitif — `lib/useRealtimeVotes.ts`
Sofistike olan budur:
- `baskets` + `ideas` + kullanıcının oyları tek `Promise.all` ile fetch.
- `postgres_changes` ile `ideas` (INSERT/UPDATE/DELETE) ve `baskets` (UPDATE) canlı dinlenir; payload'lar `ideas` dizisine **artımlı** işlenir.
- **Optimistic oy:** aynı fikre tekrar tıkla → geri al; başka fikre → taşı. `23505` (unique conflict) yutulur.
- **Dayanıklılık:** `SUBSCRIBED` status'ta reconnect + `fetchAll` (stale düzeltme); `CHANNEL_ERROR/TIMED_OUT/CLOSED` → **3sn fallback polling**; `visibilitychange` → tazeleme.
- Kullanan: `SocialBasket` ve `/present`.

### Primitifi kullanmayan diğer realtime yolları
Aşağıdakiler kendi kanallarını kurar ve her değişiklikte **tam reload** yapar (optimistic yok, reconnect/fallback yok):

| Yer | Kanal | Dinlenen tablolar |
|---|---|---|
| `app/page.tsx` | `home:live` | `baskets`, `ideas` (**filtresiz** — herhangi bir oy tüm home izleyenlerde reload tetikler) |
| `app/profil/page.tsx` | `profil:live` | `baskets` (filtresiz) |
| `components/hackathon/HackathonRunner.tsx` | `hack:${id}` | 6 tablo (filtreli): baskets, ideas, participants, teams, team_members, team_votes |
| `components/hackathon/stages/FeedbackStage.tsx` | `fb:${id}` | `feedback` |

Ayrıca **3 farklı oy-yazma yolu** var: (1) primitif optimistic `votes`, (2) `IdeaStage` doğrudan `votes` insert/delete (`phase: "idea"`), (3) `voteTeam` doğrudan `team_votes`. Hackathon oyları optimistic feedback almaz.

> Kural (DEVELOPMENT_RULES §5): `useRealtimeVotes.ts` tek realtime primitifi olarak kalır; aynı davranış için ikinci hook yazılmaz. Yukarıdaki 4 ad-hoc kanal bu kuralla **gerilimde** — birleştirme sonraki sprint adayı.

## 7. Etkinlik (sosyal) akışı

`components/social/SocialBasket.tsx` → `useRealtimeVotes`. `isOwner = voter === basket.created_by`. `status === "resolved"` → `ResultScreen`.
- **vote alt-modu:** `IdeaInput` (fikir ekle, opsiyonel tag) + `LiveVotePanel` (canlı bar, tıkla-oyla/geri-al) + owner-only "Oylamayı bitir" → en yüksek `vote_count` kazanır (`resolveBasket`).
- **raffle alt-modu:** `RaffleReveal` — owner "Kura çek" (≥2 fikir), kazanan önceden seçilip yavaşlayan isim-roll animasyonuyla açılır; `prefers-reduced-motion`'a saygılı. Konfeti yerine radial bloom.

## 8. Hackathon akışı

`components/hackathon/HackathonRunner.tsx` bir **faz makinesidir**:
- `STAGES: Record<Phase, {Comp, canAdvance}>` faz → stage component. `production` ve `done` ikisi de `ProductionStage`.
- Mount'ta lobiye **oto-join** (`created_by` → `role:"admin"`, diğerleri `member`).
- `isAdmin = basket.created_by === user.email`. Admin, alttaki sabit çubuktan **← geri / ileri →** faz geçişi yapar (`canAdvance` gate'iyle).
- **Config davranışı sürükler** (`HackathonConfig`, kod dallanmaz):
  - `ideaSource: static|pool` — static = admin tek fikir yazar (oto-seçilir); pool = herkes fikir atar.
  - `poolSelect: vote|random` — pool'dan seçim: en çok oy ya da kura.
  - `teamMode: solo|groups|one` — kişi başı takım / N grup / tek takım.
  - `groups: {count, size, assignment: random|manual}`.
- **Stage'ler:** Lobby (config + `InvitePanel`), Idea (fikir/seçim), Team (oto/manuel takım kurma via `partition`+`rebuildTeams`), **Demo (asıl canlı oylama — takıma `voteTeam`, kişi başı 1 oy)**, Feedback (serbest metin), Production (kazanan = en çok `team_votes`, admin "Üretime al" → `markDone`).
- **`InvitePanel`:** `${origin}/basket/${id}` linki + QR (`qrcode.toDataURL`) + kopyala + kozmetik kod (`id.slice(0,6).toUpperCase()`, yalnızca gösterim; katılım link ile).

## 9. Tasarım sistemi (`app/globals.css`)

Tailwind v4 (`@import "tailwindcss"` + `@theme inline`). Koyu mod. Token'lar `:root`'ta:
- **Zeminler:** `--bg:#181818`, `--card:#242424`, `--black:#0f0f0f` (featured/stage/sonuç), `--surface-2:#2a2a2a`, `--line/--line-strong/--track` (beyaz alpha).
- **Metin rampası:** `--text:#ededed` → `--text-faint:#6e6e6e`.
- **4 aksan:** `--coral:#f2795f`, `--gold:#e7a93f`, `--green:#33c293`, `--blue:#6b8cf0`. Semantik: social→coral, build→gold.
- **Fontlar:** Bricolage Grotesque (display), Plus Jakarta Sans (body). `--radius:22px`.
- **Motion:** `fs-livedot`, `fs-float` keyframes; global `prefers-reduced-motion` bloğu animasyonları kapatır.

> ⚠️ **Doküman senkron sorunu:** `CLAUDE.md`/`DESIGN-SYSTEM.md` paleti "clay `#D97757` + altın `#E3A857`" diye tarif eder; gerçek token'lar coral `#f2795f` + gold `#e7a93f`. **Kod doğru kaynaktır**; tasarım dokümanları güncellenmeli.
>
> ⚠️ Çoğu component `lib/accent.ts` token'larını kullanmak yerine hex değerleri **hardcode** eder (`page.tsx` `T` objesi, `contract.ts`, `present/page.tsx`, `NewBasketModal.tsx`).

## 10. "Plan vs Kod" — bilinçli sapmalar

`PLAN.md` daha erken, **finalist → demo → presenter → squad** odaklı bir hackathon akışı tarif eder. Güncel kod bunu **modüler config-tabanlı pipeline** (lobby→idea→team→demo→feedback→production→done) ile değiştirmiştir. Sonuç: eski akışa ait bir kısım kod **ölüdür** (bkz. §11).

## 11. Bilinen teknik borç / riskler

| # | Bulgu | Etki |
|---|---|---|
| 1 | **Env eksikse build/prerender çöker** — `lib/supabase.ts` modül yüklenirken throw; `/_not-found` prerender'ında patlar. Env ile build temiz (exit 0). | Build/deploy riski. Çözüm: env'i CI/Vercel'de zorunlu kıl; `.env.example` eklendi. |
| 2 | **Lint 16 error / 3 warning** — baskın: 7× `react-hooks/set-state-in-effect` (primitif + AuthGate + HackathonRunner + InvitePanel + profil + page + name), 5× `no-unescaped-entities`, 4× `static-components` (NewBasketModal render'da component üretiyor), 2× `no-img-element`. | Kod kalitesi. Bir kısmı realtime primitifine dokunur → ayrı hardening sprinti + manuel test planı gerekir. |
| 3 | **Ölü presenter/finalist/squad alt-sistemi** — `/present` hiçbir yerden linklenmiyor, `is_finalist`/`vote_count`'a dayanıyor ama yeni runner `is_finalist`'i **hiç set etmiyor**. `setFinalists`/`updateDemo`/`addSquadMember`/`listSquad` **çağrısız**. İki ayrı "demo oylaması" modeli (runner `team_votes` vs presenter `idea.vote_count`). | Kafa karışıklığı + ölü kod. CTO kararı: kaldır ya da yeni pipeline'a bağla. |
| 4 | **Ölü kod / bağımlılık:** `StatusPill` import edilmiyor; `canvas-confetti` hiç import edilmiyor. | Bakım gürültüsü. |
| 5 | **Dağınık realtime:** 5 kanal, 4'ü primitifin dayanıklılığını yeniden yazmadan "subscribe→full reload" yapıyor; `home`/`profil` **filtresiz** dinliyor (gereksiz global reload). | Realtime/ölçek riski. |
| 6 | **Zayıf hata yönetimi:** `lib/db.ts`/`lib/hackathon.ts` mutasyonlarının çoğu dönen `error`'ı yok sayıyor (sessiz başarısızlık). Yalnızca `23505` ele alınıyor. QR/clipboard hataları boş `catch {}`. | UX/veri riski. |
| 7 | **Denetlenmemiş tip assertion'ları:** `payload.new as Idea`, `data as Team[]` vb. yaygın; realtime payload doğrulanmadan tam-tipli varsayılıyor. `any` yok ama güvenlik zayıf. | Tip güvenliği. |
| 8 | **Transaction'sız takım kurma:** `rebuildTeams` non-transactional delete+insert döngüsü; eşzamanlı admin / ortada gelen realtime reload kısmi durum görebilir. | Veri tutarlılığı. |
| 9 | **RLS tamamen kapalı** (iç araç/demo). anon key ile herkes her tabloyu yazabilir. | Güvenlik (iç ağ için kabul, prod internet için değil). |
| 10 | **Test yok** — sadece `dev/build/start/lint` scriptleri. Playwright kurulu ama config/test yok. | Regresyon riski. |

## 12. Realtime manuel smoke test (her realtime değişiklikten sonra)

`scripts/stress.mjs` 40 sanal client ile thundering-herd simüle eder (env export gerekir; not: içindeki `phase: "voting"` değeri güncel Phase birleşimiyle uyuşmuyor — stale). İki-cihaz manuel testi:
1. İki tarayıcıda aynı `/basket/[id]` aç.
2. Cihaz A fikir ekle → **B'de anında görünmeli**.
3. A oy ver → **B'de bar güncellenmeli** (`vote_count` trigger + realtime).
4. Aynı fikre tekrar tıkla → oy geri alınmalı; başka fikre → taşınmalı.
5. B'de sekmeyi arka plana al/geri gel → `visibilitychange` ile state tazelenmeli.
6. (Opsiyonel) Ağı kes/aç → 3sn fallback polling devralmalı, dönünce reconnect + reconcile.

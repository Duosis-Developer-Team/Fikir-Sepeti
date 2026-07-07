# Fikir-Sepeti

İç ekip (yazılım şirketi, ~10-20 kişi) için **fikir toplama + karar + iç hackathon** aracı. Ekip bir konu için "sepet" açar, fikir atar ve **oy** ya da **kura** ile karar verir. Hackathon modunda ise fikirden takıma, canlı demo oylamasından üretime kadar bir pipeline yürür. Realtime oylama ürünün omurgasıdır.

İki sepet tipi:
- **etkinlik** (sosyal): fikir → oy / kura → sonuç.
- **hackathon** (build): lobi → fikir → takım → demo (canlı takım oylaması) → feedback → production/done.

> Mimarinin kod-gerçekliğine dayalı tam dökümü: [`docs/CURRENT_ARCHITECTURE.md`](docs/CURRENT_ARCHITECTURE.md)
> Supabase şema denetimi: [`docs/CURRENT_SCHEMA_AUDIT.md`](docs/CURRENT_SCHEMA_AUDIT.md)

## Stack

Next.js 16.2 (App Router, Turbopack) · React 19.2 · TypeScript 5 (`strict`) · Supabase (Postgres + Realtime) · Tailwind CSS v4 · `motion` 12 · `qrcode`. Deploy hedefi: Vercel.

> ⚠️ Bu, alıştığın Next.js **değil**. App Router/API'ye dokunmadan önce `AGENTS.md`'i ve `node_modules/next/dist/docs/` içindeki ilgili rehberi oku, değişikliği build ile doğrula.

## Kurulum (local)

```bash
# 1) Bağımlılıklar
npm install

# 2) Ortam değişkenleri
cp .env.example .env.local
#   .env.local içindeki Supabase URL/anon key'i doldur (aşağıya bak).
#   Yerel geliştirmede NEXT_PUBLIC_AUTH_BYPASS=1 bırakabilirsin.

# 3) Geliştirme sunucusu
npm run dev        # http://localhost:3000
```

> Node 20+ önerilir (repo Node 23'te de build ediyor; `next` engine uyarısı zararsız).

## Ortam değişkenleri

Tümü `NEXT_PUBLIC_*` (client'a inline edilir). Örnek: [`.env.example`](.env.example).

| Değişken | Zorunlu | Açıklama |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase proje URL'i. **Eksikse uygulama açılışta bilerek hata fırlatır** (`lib/supabase.ts`) ve `next build` prerender aşamasında başarısız olur. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon (public) key. |
| `NEXT_PUBLIC_AUTH_BYPASS` | ⬜ | `"1"` → Azure/Microsoft OAuth atlanır; kimlik localStorage'daki isim/e-postadan gelir. Yerel/demo için `1`. |

> 🔒 `.env*` dosyaları `.gitignore`'dadır. **Gerçek anahtarları asla commit etme.**

## Supabase kurulumu

1. Supabase'de bir proje oluştur.
2. `supabase/schema.sql`'i SQL Editor'de çalıştır — tablolar, `vote_count` trigger'ı ve realtime publication'ı kurar (idempotent).
3. `NEXT_PUBLIC_SUPABASE_URL` ve `NEXT_PUBLIC_SUPABASE_ANON_KEY`'i `.env.local`'e koy.
4. (Gerçek Azure girişi için) Supabase Auth'ta Azure provider'ını yapılandır. Aksi halde `NEXT_PUBLIC_AUTH_BYPASS=1` kullan.
5. Demo verisi repo'da **yok** — seed uzak projede manuel. Detay: `docs/CURRENT_SCHEMA_AUDIT.md`.

> Not: Tüm tablolarda **RLS kapalıdır** (iç araç/demo). İnternete açık prod öncesi güvenlik revizyonu gerekir (CTO onaylı konu).

## Scriptler

| Komut | Ne yapar | Durum |
|---|---|---|
| `npm run dev` | Turbopack dev sunucusu | ✅ |
| `npm run build` | Prod build | ✅ **env varsa** (env yoksa prerender'da çöker) |
| `npm run start` | Prod sunucu | ✅ |
| `npm run lint` | ESLint | ⚠️ Şu an hata veriyor (bkz. `docs/CURRENT_ARCHITECTURE.md` §11) |
| `node scripts/stress.mjs <basket_id> <idea1,idea2>` | 40 sanal client realtime stres testi | ⚠️ İçindeki `phase` değeri stale |

Test framework'ü henüz **yok** (Playwright kurulu ama config/test dosyası yok). Realtime değişikliklerinde manuel smoke test için `docs/CURRENT_ARCHITECTURE.md` §12.

## Demo akışı (hızlı tur)

1. `/` — ana feed; "Yeni sepet" ile etkinlik veya hackathon aç.
2. **Etkinlik/vote:** fikir ekle, canlı bar üzerinden oyla; sahip "Oylamayı bitir" ile kazananı çeker.
3. **Etkinlik/kura:** fikirleri ekle, sahip "Kura çek" ile rastgele kazananı açar.
4. **Hackathon:** lobide config + davet (link/QR/kod); admin fazları ilerletir; demo fazında takıma canlı oy verilir; production'da kazanan üretime alınır.

## Repo remote'ları

Resmi çalışma reposu **`Duosis-Developer-Team/Fikir-Sepeti`** (private).

```
origin    https://github.com/Duosis-Developer-Team/Fikir-Sepeti.git   # source of truth, tüm push'lar buraya
upstream  https://github.com/ArcaNamlisarac/Fikir-Sepeti.git          # yalnızca orijinal kaynak; push YOK
```

## Geliştirme kuralları

Bağlayıcı kurallar: `AGENTS.md`, `CLAUDE.md`, `DESIGN-SYSTEM.md` ve CTO paketindeki `DEVELOPMENT_RULES.md`. Özet:
- Kaynak gerçeklik: kod → Supabase şeması → `lib/types.ts` → `DESIGN-SYSTEM.md`. `PLAN.md` yalnızca tarihseldir.
- Realtime primitifi tek: `lib/useRealtimeVotes.ts`. İkinci realtime sistemi yazma.
- Token dışı renk yok; koyu/nötr tasarım korunur; mobile-first.
- Şema değişirse SQL migration + geriye-dönük etki notu.
- Küçük, tek-mantıklı commit; secret commit etme.

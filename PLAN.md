# Fikir Sepeti — Build Plan v2 (Tek Gün / Demo: Perşembe)

> Claude Code'a doğrudan yem. Sıralı oku, blok blok ilerle.
> **Kapsam (güncellendi):** İki mod TAM (sosyal + build) + app-içi presenter + realtime (herkes telefondan canlı oy).
> Deadline: **Perşembe demo**. Bugün sen omurga + realtime + kura + build akışını çıkar, cila/artıkları partnere pasla.

---

## ⚠️ Gerçeklik notu (önce oku)

İki mod tam + presenter + realtime, tek kişi tek günde iddialı. Bitmesi şuna bağlı:
1. **Realtime oylama primitifini BİR KERE yaz, üç yerde kullan** (sosyal oy / build demo oy / presenter barı). Kaldıraç bu.
2. Build modu çok fazlı — asıl karmaşa burada. Faz geçişlerini basit tut (tek `phase` alanı).
3. Presenter = mevcut verinin büyük-ekran görünümü. Yeni mantık değil, yeni layout.
4. Cila / boş durumlar / arşiv / auth → partnere. Sen "çalışan + wow" bırak, o güzelleştirsin.

Kesme sırası (vakit biterse şu sırayla kes): arşiv → auth → build squad ekranı → presenter geçiş animasyonları → sosyal kura confetti. **Kesme:** realtime, iki modun döngüsü, kura reveal.

---

## 0. Ürün özeti

İç araç, yazılım şirketi, ~10-20 kişi. Web + mobil web. İki mod:

- **Sosyal mod:** Fikir at (nereye gidelim / ne yapalım) → **kura** veya **oylama** ile sonuç. İmza an: kura reveal.
- **Build mod (iç hackathon):** Fikir at → oylama ile **finalist** seç → finalistlere **demo** ekle (link + canlı sunum) → **presenter modunda** demo demo gezilir, herkes telefondan canlı oy verir → kazanan → **squad** (kim ortak).

---

## 1. Kapsam kilidi

### ✅ Demoya giren
**Ortak / altyapı**
- İsim seç (auth yerine, localStorage)
- Sepet oluştur (tip: sosyal | build)
- **Realtime oylama primitifi** (votes + Supabase Realtime) — HER YERDE kullanılır

**Sosyal mod**
- Fikir ekle/listele
- Oylama (canlı barlar) VEYA kura (shuffle → reveal → confetti)
- Sonuç ekranı

**Build mod**
- Faz 1: fikir toplama (etiket opsiyonel: AI/backend/mobil)
- Faz 2: oylama → finalist seçimi
- Faz 3: finalistlere demo ekle (demo_url + presenter adı + canlı sunum saati)
- Faz 4: **Presenter modu** (tam ekran, yansıtılır) — sıradaki demo büyük, altta canlı oylama barı realtime dolar
- Faz 5: kazanan + squad (kim ortak — isim listesi)

### ❌ Demoya girmeyen (partnere / sonra)
- Auth / Google SSO (şimdi isim seç yeter)
- Arşiv / geçmiş sepetler
- Bildirim / Slack webhook
- Süre limiti otomasyonu (manuel "sonucu çek" yeter)
- Rol/yetki yönetimi

---

## 2. Stack

| Katman | Seçim | Not |
|---|---|---|
| Framework | **Next.js** (App Router) | Çoğu client component. Vercel deploy. |
| DB / Realtime | **Supabase** | Postgres + **Realtime** (bu sefer ŞART). |
| Animasyon | **Motion** (framer-motion) | `import { motion, useAnimate, AnimatePresence } from "motion/react"` |
| Stil | **Tailwind CSS** | |
| Efekt | `canvas-confetti` | Kura + kazanan anı. |
| Deploy | **Vercel** | |

```bash
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir
npm install motion @supabase/supabase-js canvas-confetti
npm install -D @types/canvas-confetti
```

---

## 3. Klasör yapısı

```
/app
  layout.tsx
  page.tsx                       # ana ekran: sepet listesi (sosyal + build karışık) + yeni sepet
  /basket/[id]
    page.tsx                     # sepet detay — type'a göre sosyal VEYA build akışı render
    /present
      page.tsx                   # PRESENTER modu (build) — tam ekran, yansıtılır
/components
  NameGate.tsx
  BasketCard.tsx                 # sepet kartı (tip rengine göre: sosyal=yeşil, build=mor accent)
  NewBasketModal.tsx             # yeni sepet (tip seç: sosyal/build)
  /social
    SocialBasket.tsx             # sosyal akış container
    IdeaCard.tsx
    IdeaInput.tsx
    RaffleReveal.tsx             # İMZA: kura shuffle+reveal
  /build
    BuildBasket.tsx              # build akış container (faz yönetimi)
    PhaseBar.tsx                 # fikir→finalist→demo→oylama→squad ilerleme
    FinalistPicker.tsx           # oylama → finalist seçimi
    DemoCard.tsx                 # finalist + demo_url + presenter + saat
    SquadPicker.tsx              # kim ortak
  /shared
    LiveVotePanel.tsx            # ★ REALTIME OYLAMA PRIMITIFI — sosyal + build + presenter kullanır
    ResultScreen.tsx
    StatusPill.tsx
/lib
  supabase.ts
  types.ts
  useRealtimeVotes.ts            # ★ realtime hook — votes kanalını dinler
  useBasket.ts
/styles (globals.css — tema token'ları)
```

---

## 4. Veri modeli (Supabase SQL)

```sql
create table baskets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null default 'social',          -- 'social' | 'build'
  resolve_method text not null default 'vote',   -- sosyal: 'vote' | 'raffle'
  phase text not null default 'ideas',           -- ortak faz alanı, aşağıda
  status text not null default 'active',          -- 'active' | 'resolved'
  winner_idea_id uuid,
  current_demo_idx int default 0,                -- presenter: kaçıncı demo sahnede
  created_by text,
  created_at timestamptz default now()
);
-- phase değerleri:
--   sosyal: 'ideas' -> 'resolved'
--   build:  'ideas' -> 'finalists' -> 'demos' -> 'voting' -> 'squad' -> 'resolved'

create table ideas (
  id uuid primary key default gen_random_uuid(),
  basket_id uuid not null references baskets(id) on delete cascade,
  text text not null,
  tag text,                                       -- build: 'AI'|'backend'|'mobil' vs (opsiyonel)
  is_finalist boolean not null default false,     -- build: oylama sonrası true
  demo_url text,                                  -- build: finalist demosu
  presenter text,                                 -- build: kim sunuyor
  live_at text,                                   -- build: canlı sunum saati (basit text)
  created_by text,
  vote_count int not null default 0,
  created_at timestamptz default now()
);

create table votes (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references ideas(id) on delete cascade,
  basket_id uuid not null references baskets(id) on delete cascade,
  phase text not null default 'ideas',            -- hangi fazın oyu (fikir oyu vs demo oyu ayrı)
  voter text not null,
  created_at timestamptz default now(),
  unique (basket_id, phase, voter)                -- sepet+faz başına 1 oy (build'de 2 oylama var)
);

create table squad_members (                      -- build: kazanan projeye kim katıldı
  id uuid primary key default gen_random_uuid(),
  basket_id uuid not null references baskets(id) on delete cascade,
  member text not null,
  created_at timestamptz default now(),
  unique (basket_id, member)
);

alter table baskets disable row level security;
alter table ideas disable row level security;
alter table votes disable row level security;
alter table squad_members disable row level security;

-- oy sayacı
create or replace function bump_vote_count() returns trigger as $$
begin
  if (TG_OP = 'INSERT') then
    update ideas set vote_count = vote_count + 1 where id = NEW.idea_id;
  elsif (TG_OP = 'DELETE') then
    update ideas set vote_count = vote_count - 1 where id = OLD.idea_id;
  end if;
  return null;
end; $$ language plpgsql;

create trigger vote_count_trigger
after insert or delete on votes
for each row execute function bump_vote_count();

-- ★ REALTIME: bu tabloları publication'a ekle
alter publication supabase_realtime add table votes;
alter publication supabase_realtime add table ideas;
alter publication supabase_realtime add table baskets;
```

> `phase` alanı votes'ta neden var: build modda İKİ oylama oluyor (finalist seçimi + demo oylaması). Aynı kişi ikisinde de oy verebilmeli ama her fazda 1 kez. `unique(basket_id, phase, voter)` bunu çözer.

`lib/types.ts`:
```ts
export type Basket = {
  id: string; title: string;
  type: 'social' | 'build';
  resolve_method: 'vote' | 'raffle';
  phase: string; status: 'active' | 'resolved';
  winner_idea_id: string | null;
  current_demo_idx: number;
  created_by: string | null; created_at: string;
};
export type Idea = {
  id: string; basket_id: string; text: string;
  tag: string | null; is_finalist: boolean;
  demo_url: string | null; presenter: string | null; live_at: string | null;
  created_by: string | null; vote_count: number; created_at: string;
};
```

---

## 5. ★ Realtime oylama primitifi (KALDIRAÇ — önce bunu yaz)

`lib/useRealtimeVotes.ts` — bir sepetin belirli fazındaki oyları canlı dinler.

Mantık:
- `supabase.channel('basket:'+id)` aç.
- `postgres_changes` ile `ideas` tablosundaki `vote_count` UPDATE'lerini dinle (trigger güncelliyor).
- Ayrıca `baskets` UPDATE dinle (faz geçişi + `current_demo_idx` presenter için).
- State: `{ ideas: Idea[], basket: Basket }` canlı güncellenir.
- Oy ver fonksiyonu: `votes` insert (unique constraint çift oyu engeller — hata yakalanır, sessizce yut).

Bu hook 3 yerde kullanılır:
1. **Sosyal oylama** → `phase='ideas'`, barlar canlı.
2. **Build finalist seçimi** → `phase='finalists'`.
3. **Build demo oylaması / presenter** → `phase='voting'`, presenter büyük ekranda aynı state'i gösterir.

`LiveVotePanel.tsx` bu hook'u tüketen tek görsel component. Sosyal ve build ikisi de bunu render eder, sadece stil/boyut değişir (presenter'da dev boyut).

---

## 6. Akışlar

### Sosyal (oylama)
`ideas` → herkes fikir atar + canlı oy verir (LiveVotePanel) → "Sonucu çek" → en yüksek → `resolved` → ResultScreen.

### Sosyal (kura)
`ideas` → fikir atılır → "Kurayı çek" → RaffleReveal → kazanan → `resolved`.

### Build (çok fazlı)
1. **ideas:** herkes fikir atar (+ opsiyonel etiket).
2. **finalists:** LiveVotePanel (`phase=finalists`) → en çok oy alan N fikir `is_finalist=true`. "Finalistleri kilitle" butonu → `phase=demos`.
3. **demos:** her finalist kartına demo_url + presenter + saat girilir. "Sunuma hazır" → `phase=voting`.
4. **voting + PRESENTER:** `/basket/[id]/present` açılır (yansıtılır). Sıradaki demo büyük gösterilir (`current_demo_idx`). Herkes telefondan `/basket/[id]`'de LiveVotePanel ile oy verir → presenter barı realtime dolar. "Sonraki demo" → `current_demo_idx++` (realtime herkese yansır).
5. **squad:** en çok oylu demo kazanır → SquadPicker: kim ortak (squad_members insert). → `resolved` + ResultScreen (kazanan + squad listesi).

---

## 7. Saat saat build sırası

> Sıra kutsal: önce çalışan döngü + realtime, sonra build fazları, EN SON cila/animasyon.

### Blok 1 — İskelet + realtime primitif
1. create-next-app + paketler + Supabase + SQL (realtime publication dahil).
2. supabase.ts, types.ts, .env.local, NameGate.
3. Ana ekran: sepet listele + yeni sepet (tip seç). Sepet detay iskeleti (type'a göre dallan).
4. **★ `useRealtimeVotes` + `LiveVotePanel`** — çirkin ama çalışan canlı oylama. İki tarayıcı aç, birinde oy ver, diğerinde bar hareket etsin.
5. **Checkpoint:** Realtime oylama çalışıyor. Bu bittiyse en riskli kısım geçti.

### Blok 2 — Sosyal mod tam
6. Fikir ekle/listele. Sosyal oylama = LiveVotePanel(`phase=ideas`). "Sonucu çek".
7. Kura resolve (mantık, animasyon sonra). ResultScreen.
8. **Checkpoint:** Sosyal mod uçtan uca çalışıyor (oylama + kura).

### Blok 3 — Build mod fazları
9. BuildBasket + PhaseBar (faz göster/geçiş). Fikir toplama fazı.
10. Finalist fazı: LiveVotePanel(`phase=finalists`) → "kilitle" → is_finalist set.
11. Demo fazı: DemoCard'a url+presenter+saat gir.
12. Voting fazı + `/present` route: presenter tam ekran, current_demo_idx, altta LiveVotePanel(`phase=voting`) dev boyut. "Sonraki demo" realtime.
13. Squad fazı: SquadPicker → resolved.
14. **Checkpoint:** Build mod uçtan uca (çirkin ama tam). Telefondan oy → presenter'da bar dolsun.

### Blok 4 — İMZA + cila + demo verisi
15. RaffleReveal (Bölüm 8). Kura akışına bağla.
16. Tasarım token'ları (Bölüm 9). Sosyal=yeşil accent, build=mor accent kart ayrımı.
17. Mikro-animasyonlar: kart enter/exit (AnimatePresence), bar spring dolumu, buton tap, presenter demo geçişi.
18. Mobil web: tek kolon, büyük dokunma hedefleri, oylama telefonda rahat.
19. **Demo verisi:** 1 sosyal-oylama, 1 sosyal-kura, 1 build sepeti (finalistleri+demoları hazır, presenter'a girecek şekilde) önceden doldur.
20. Vercel deploy + telefon + yansıtma testi.

### Partnere pas (README)
21. Env, çalıştırma, biten/kalan. Öncelik: auth → arşiv → süre limiti otomasyonu → Slack webhook.

---

## 8. İMZA AN: Kura animasyonu (`RaffleReveal`)

`useAnimate` + `AnimatePresence`. Akış:
1. **Shuffle (~1.5-2sn):** spotlight kartlar arası hızlı zıplar.
2. **Yavaşlama (~1sn):** interval artan gecikmeyle düşer (80→120→180→280→400ms).
3. **Kilitlenme:** kazananda durur.
4. **Reveal:** kazanan kart scale spring + accent glow + `confetti({particleCount:120, spread:70, origin:{y:0.6}})`.
5. → ResultScreen.

Notlar: kazananı ÖNCE seç (client random), animasyon görsel. `prefers-reduced-motion` → shuffle atla, direkt reveal.

---

## 9. Tasarım dili (calm premium)

```css
:root {
  --bg:#FAFAF9; --surface:#FFFFFF; --border:#EAE8E3;
  --text:#1C1C1A; --text-muted:#6B6A66;
  --accent-social:#1D9E75;   /* yeşil — sosyal mod */
  --accent-build:#534AB7;    /* mor — build mod + presenter */
  --radius:12px;
}
```
- İki mod iki accent'le ayrışır (yeşil/mor). Onun dışında her yer nötr.
- Kart: beyaz, 0.5px border, 12px radius, minimal gölge, bol whitespace.
- İki font ağırlığı (400/500). Sentence case. Asla Title Case.
- Motion: spring, kısa, abartısız (`stiffness:400, damping:30`). İmza an (kura + presenter reveal) yoğun, gerisi hafif.
- **Panayır tuzağı:** efektleri TEK yerde topla. Presenter + kura zaten "wow", başka yere confetti/spotlight ekleme.

### Presenter modu (build, tam ekran, yansıtılır)
- Sahnedeki demo büyük: başlık + açıklama + etiketler + demo alanı (video/link).
- Altta LiveVotePanel dev boyut: sadece kazanan bar mor, diğerleri gri → göz lidere gitsin.
- Üstte "3/5 demo · canlı" + oy sayacı ("14/16 oy verdi") → sosyal baskı.
- "Önceki / Sonraki demo" → current_demo_idx, realtime herkese yansır.

---

## 10. NotebookLM'e araştırtılacaklar
1. Supabase Realtime `postgres_changes` — channel, UPDATE dinleme, React hook pattern. **(En kritik — önce bu.)**
2. Motion v12 `useAnimate` sequence + `AnimatePresence` enter/exit.
3. Slot-machine / raffle reveal — hız yavaşlatma (artan interval) örnekleri.
4. canvas-confetti React kullanımı.
5. Referans (kopya, dikkatli): ui.aceternity.com (glow/sparkle), magicui.design (AnimatedNumber → oy sayacı), motion-primitives (GitHub itsjwill/motion-primitives-website), reactbits.dev, motion.dev/examples.

---

## 11. Stres testi + dayanıklılık (donma/timeout SIFIR)

Hedef: 20 kişiyiz ama **40 eşzamanlı** gibi davransın. Hiç donma, hiç timeout.

### Gerçek çerçeve
40 kişi = yük problemi DEĞİL, **dayanıklılık** problemi. Postgres/Realtime 40 bağlantıda terlemez. Donma/timeout şu 4 yerden gelir; hepsini kapat:

**A) Thundering herd (reveal anı)**
Presenter'da herkes aynı saniyede oy verir → 40 insert bir anda.
- Oy butonuna **optimistic update:** tıkla → UI anında dolsun (server beklenmez), arkada insert. Server echo gelince reconcile et. Kullanıcı bekleme hissetmez.
- Oy ver fonksiyonu **debounce/lock:** insert dönene kadar buton disabled (çift tık yok).
- Bar dolumu realtime echo'dan DEĞİL, optimistic local'den beslensin; realtime sadece BAŞKALARININ oyunu getirsin. (Kendi oyunu iki kez sayma.)

**B) Realtime bağlantı kopması (asıl timeout kaynağı)**
Wifi dalgalanır / sekme arka plana gider → kanal düşer.
- Supabase channel'a **reconnect** kur: `.on('system')` / `CHANNEL_ERROR` yakala → otomatik re-subscribe.
- **Fallback polling:** realtime koparsa 3sn'de bir `ideas` çek (setInterval), bağlantı gelince durdur. Ekran asla "donmuş" görünmez.
- Sayfa görünürlüğü: `visibilitychange` → sekme geri gelince state'i bir kez zorla yenile (stale veri düzelsin).

**C) Çift oy / race condition**
- `unique(basket_id, phase, voter)` var. Insert hata dönerse (23505) **sessizce yut**, kullanıcıya hata gösterme — zaten oy vermiş.
- Optimistic ekledikten sonra insert fail olursa optimistic'i geri al (rollback).

**D) Görsel donma algısı (gerçek donma olmasa bile)**
- Her async işlemde **skeleton/loading state** — boş beyaz ekran yok.
- Presenter "sonraki demo" geçişi: eski demo fade-out + yeni fade-in, ekran bir an boş kalmasın.
- Suspense/error boundary: bir component patlarsa tüm app değil o kısım düşsün.

### Test scripti (Node — 40 sanal client)
`scripts/stress.mjs`. Amaç: 40 client bağlan, hepsi aynı sepetin aynı fazına saldırsın, arada kopar-bağlan.

```js
// node scripts/stress.mjs
import { createClient } from '@supabase/supabase-js';
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASKET = process.argv[2];           // test sepeti id
const IDEAS  = process.argv[3].split(','); // idea id'leri virgüllü
const N = 40;

async function client(i) {
  const sb = createClient(URL, KEY);
  // 1) realtime'a abone ol (40 eşzamanlı kanal)
  const ch = sb.channel('basket:' + BASKET)
    .on('postgres_changes', { event:'*', schema:'public', table:'ideas' }, () => {})
    .subscribe();
  // 2) rastgele gecikmeyle aynı fazda oy ver (thundering herd simülasyonu)
  await new Promise(r => setTimeout(r, Math.random()*500));
  const idea = IDEAS[Math.floor(Math.random()*IDEAS.length)];
  const t0 = Date.now();
  const { error } = await sb.from('votes').insert({
    basket_id: BASKET, idea_id: idea, phase: 'voting', voter: 'stress_'+i
  });
  const ms = Date.now() - t0;
  if (error && error.code !== '23505') console.log(`client ${i} ERR`, error.message);
  else console.log(`client ${i} ok ${ms}ms`);
  // 3) 2sn sonra kanalı kopar (reconnect testi)
  setTimeout(() => sb.removeChannel(ch), 2000);
}

console.time('all');
await Promise.all(Array.from({length:N}, (_,i) => client(i)));
console.timeEnd('all');
```

Çalıştır: `node scripts/stress.mjs <basket_id> <idea1,idea2,idea3>`

Beklenen: her client insert'i **<300ms**, hepsi paralel, tek hata çift-oy (23505) — o da beklenen. Bir de scripti çalıştırırken **tarayıcıda presenter'ı açık tut**, barların canlı ve pürüzsüz dolduğunu gör.

### İkinci test: bağlantı kopma
- Presenter açıkken DevTools → Network → **Offline** yap 5sn → **Online** yap. Fallback polling devreye girdi mi, geri gelince state düzeldi mi?
- Mobilde: sekmeyi arka plana at 10sn, geri gel. Donmuş mu, yenilendi mi?

### Supabase limitleri (DEMODAN ÖNCE DOĞRULA)
- Realtime **eşzamanlı bağlantı** ve **mesaj/sn** limiti plana göre değişir. 40 bağlantı free tier'da rahat olmalı ama **kendi planının güncel limitini panelden teyit et** — demoda sürpriz olmasın.
- Presenter'da tek büyük ekran + 20 telefon = ~21 kanal. Sorun değil ama teyit et.

---

## 12. Demo günü checklist (Perşembe)
- [ ] Vercel canlı + link
- [ ] Demo verisi hazır: 1 sosyal-oylama, 1 sosyal-kura (4-5 fikir), 1 build (finalist+demo dolu)
- [ ] İki cihaz testi: telefondan oy → presenter'da bar canlı dolsun (realtime çalışıyor mu?)
- [ ] Kura reveal → confetti pürüzsüz mü?
- [ ] Presenter yansıtmada düzgün + "sonraki demo" herkese yansıyor mu?
- [ ] Akışı baştan sona 1 prova
- [ ] **Stres testi geçti:** `node scripts/stress.mjs` — 40 client, tüm insert'ler <300ms, presenter barları pürüzsüz
- [ ] **Kopma testi geçti:** offline→online + sekme arka plan→ön → hiç donma, state düzeliyor
- [ ] **Supabase realtime limiti** kendi planında teyit edildi
- [ ] Yedek: local `npm run dev`

---

**Özet mantık:** Realtime primitifi (Blok 1) en riskli + en değerli — bir kere yaz, üç yerde kullan. Sosyal mod (Blok 2) hızlı. Build fazları (Blok 3) asıl iş. Cila + kura + demo verisi (Blok 4) en son. Vakit biterse: arşiv/auth/squad ekranı kesilir; realtime + iki modun döngüsü + kura ASLA kesilmez. Dayanıklılık (optimistic + reconnect + fallback polling) da kesilmez — asıl donma/timeout oradan gelir, demoda en çok o rezil eder.
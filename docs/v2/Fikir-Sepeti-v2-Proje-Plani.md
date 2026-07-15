# Fikir Sepeti — v2 Proje Planı

**Tarih:** 14 Temmuz 2026 · **Revizyon:** 3 (kimlik + odak revizyonu)
**Durum:** Uygulama öncesi karar + kapsam dokümanı
**Hedef okur:** Bu planı uygulayacak geliştirme ajanı (ve Duo)

> Bu doküman **ne yapılacağını** tanımlar, kodu yazmaz. Kapsam kilidi, veri modeli ve kabul
> kriterleri burada; sprint sırası ayrı dokümanda. Ajan buradan başlar, kod deposundaki
> `CLAUDE.md` + `DESIGN-SYSTEM.md` ile birlikte okur.

---

## 1. Kimlik

| | |
|---|---|
| **Tagline** | **"Fikirden prototipe."** |
| **Tek cümle** | Fikir Sepeti, çalışan fikirlerini **üretim kararına hazır prototiplere** dönüştüren platformdur. |

*(İç not — hedeflediğimiz alan: kurumsal prototipleme / iç inovasyon çıktısı. Bu bir vitrin
etiketi değil; ürün kendini tagline ve tek cümleyle tanıtır. Kategori adı **bilinçli olarak
konmuyor** — "kurumsal inovasyon yönetimi" demek bizi Brightidea/edison365/Qmarkets ile aynı
rafa koyar ve "niye onların yaptığını yapamıyorsunuz?" sorusunu satış masasına davet eder.)*

**Sınır — en önemli cümle:** Fikri **üretim kapısına kadar** getiriyoruz. Kapıdan sonrası
mühendislik — ya da Hermes. Bu sınır tesadüfi değil, portföyün devir noktası.

**Ne DEĞİL:**
- **İnovasyon yönetimi değil** — süreç yönetmiyoruz, çıktı üretiyoruz. Onların çıktısı rapor;
  bizimki çalışan bir şey.
- **Fikir kutusu değil** — toplamıyoruz, çıkarıyoruz. *Kutu toplar; biz prototip çıkarırız.*
- **İletişim platformu değil** — Viva Engage konuşturur.
- **Üretim aracı değil** — kapıya kadar.

**Metafor (arayüzün dili, tagline değil):** Ürünün adı hikâyeyi zaten anlatıyor — **sepet =
kavanoz**. Fikirler kağıt gibi kavanoza atılır, kavanozdan çekilir. Çekme anı ürünün **imza
anıdır**. Vitrinde "fikirden prototipe" yazar; kapıdan girince kavanozdan fikir çekersin.
İkisi çelişmez: biri satar, diğeri tutar.

**Amaç:** Verimliliği **eğlenceli biçimde** artırmak. Eğlence *nasıl*ın parçası, *ne*nin değil —
benimseme mekanizmasıdır, satış argümanı değil.

**Moat:**
1. **Portföy:** Prototip → Hermes'te faturalandırılabilir iş. Rakiplerin hiçbirinde zaman/iş
   takip ürünü yok; "fikir gerçekten yapıldı, şu kadar efor gitti" kanıtını kimse üretemiyor.
2. **Çıktı odağı:** Kategori süreç yönetiyor, biz prototip çıkarıyoruz.
3. **Ücretsiz + açık + Türkçe:** Yerli oyuncular ücretli ve Kaizen lezzetli; global oyuncular
   pahalı ve İngilizce.

---

## 2. Mevcut durum (kod gerçeği)

Repo: `Duosis-Developer-Team/Fikir-Sepeti` · yerelde `~/Fikir-Sepeti` · 32 commit · Vercel'de canlı.

**Stack:** Next.js 16 (App Router) · React 19 · Supabase (Postgres + Realtime) · Azure Entra ID
(OAuth) · Motion 12 · Tailwind 4 · canvas-confetti · qrcode.

| Tip | Faz zinciri | Kod | Durum |
|---|---|---|---|
| `etkinlik` | `ideas → resolved` | `SocialBasket.tsx` (89 satır) | Çok ince. Fikir at → oy **veya** kura → kazanan. |
| `hackathon` | `lobby → idea → team → hackathon → demo → feedback → production → done` | 8 stage modülü + orchestrator | Olgun. Config-driven modüler monolit. |

**Ne çalışıyor:**
- Realtime oylama primitifi (`useRealtimeVotes`) — optimistic + reconnect + fallback polling. Sağlam.
- Hackathon modül sözleşmesi (`contract.ts`): `StageDef { key, Comp, canAdvance }`. **v2 bunu korumalı.**
- Config ile davranış seçimi. Azure girişi. Lobi daveti: link + QR + kod (`InvitePanel.tsx`).

**🔴 Kritik bulgu — imza an yanlış yere bağlı:**
- `RaffleReveal.tsx` (191 satır: shuffle → yavaşlama → kilitlenme → reveal) **sadece
  `SocialBasket`'te** kullanılıyor. Yani "akşam nereye gidelim"de.
- Hackathon'da fikir çekimi `IdeaStage.tsx:51`'de çıplak tek satır:
  `const pick = ideas[Math.floor(Math.random() * ideas.length)];` — animasyon yok, drama yok.
- `canvas-confetti` paketi kurulu ama **hiçbir yerde kullanılmıyor** (orijinal PLAN.md onu
  "İMZA AN" diye tanımlamış).
- **Sonuç:** En değerli çekiliş (hangi fikir yapılacak, kim kimin fikrini yapacak) dramasız;
  en değersizi şölen. Varlık hazır — **taşınacak**, yeniden yazılmayacak.

**Ne yok:**
- **Çok-kiracılık ve RBAC yok.** Tek Azure tenant. Rol = `admin | member`, sepet bazlı.
- **RLS kapalı.** Anon key public → linki bilen herkes her satırı okur/yazar.
- **Kavanoz (fikir deposu) yok.** Fikirler sepetin içinde doğar, sepetle ölür.
- **Kategori/yıldız puanlama yok.** Kişi başı tek oy.
- **Arşiv yok. Analitik yok.** Biten sepet `resolved` olur, kimse bir daha bakmaz.
- **Moderasyon yok.** **Jüri rolü yok.** **Lobi kontrolü yok.**
- **Tek fikir kısıtı** (`selected_idea_id` tekil) — bütün takımlar aynı fikri yapar.
- **Feedback proje bazlı değil.** `feedback.team_id`/`idea_id` kolonları **var ama UI kullanmıyor.**

---

## 3. Mimari: tek ana hat, bir yan dal

El yazısı not omurgayı zaten söylüyor: `fikir → oylama/kura → organizasyon → sonuç`.
**Revizyon 3'te ana hat sadeleşti** — Etkinlik ve Hackathon artık simetrik iki çıkış değil:

```
┌──────────────────────────────────────┐
│  KAVANOZ  (fikir deposu)             │  her an fikir at · poll aç · oy ver
│  tenant seviyesinde kalıcı           │  "ofiste şu eksik" · "web sitesini yenileyelim"
└──────────────┬───────────────────────┘
               │  ★ ÇEKİLİŞ / oylama   ← imza an; eğlence buraya gömülü
               ▼
┌──────────────────────────────────────┐
│  HACKATHON   ← ANA HAT               │  lobi · takım · yapım · puanlama
│  üretilebilir fikri prototipe çevir  │
└──────────────┬───────────────────────┘
               ▼
┌──────────────────────────────────────┐
│  ÜRETİME ALINDI  → efor → Hermes     │  ← üretim kapısı; sınırımız burası
└──────────────┬───────────────────────┘
               │  seçilmeyen fikirler geri döner
               └──────────► KAVANOZ

        ↘ ETKİNLİK (yan dal, opsiyon, 3./4. planda)
          Bugünkü hali korunur: fikir at → oy/kura → kazanan.
```

**Etkinlik neden kalıyor (çöpe atılmıyor):** O **alışkanlık katmanı** — insanı haftada bir içeri
sokan şey. Hackathon ayda bir; 3. ay katılımını ölçeceksek uygulamayı açmanın tek sebebi aylık
hackathon olamaz. Ama **zenginleştirilmiyor**: bugünkü hali ("akşam nereye gidelim") bu iş için
zaten yeterli — tarih alanına ihtiyaç yok.

**Kritik kısıt — hızlı yol korunur.** Kavanoza uğramadan doğrudan sepet açılabilmeli
(bugünkü davranış). Bu bir regresyon testidir.

### 3.1 RBAC + çok-kiracılık = temel, sonradan eklenmez

**Duo kararı:** Ürünün enterprise olabilmesi için önce RBAC gerekiyor. Kim ne açabilir, kim jüri,
kim moderatör — platform sahibi ve tenant'ları tarafından **düzenlenebilir** olmalı.

Sıralaması doğru: çok-kiracılığı sonradan takmak her tabloyu yeniden migrate etmek demektir.

**Ama:** *RLS kapalıyken RBAC dekordur.* Anon key public; kullanıcı devtools'tan doğrudan tabloya
yazar, UI'daki rol kontrolü hiçbir şey ifade etmez. **RBAC istemek RLS'i açmayı zorunlu kılar.**

**Portföy notu:** LogiSlot `Platform → Tenant → Facility` terminolojisini oturtmuş. Fikir Sepeti
`Platform → Tenant → Kullanıcı` ile hizalanır. Aynı deseni kullan.

### 3.2 Yönetişim bir kadran — varsayılanı hafif

Her fikir moderasyon kapısından geçerse ve oyu üst kademe görürse, elde kalan şey kimsenin
kullanmadığı bir kurumsal öneri kutusudur. **Çözüm:** yönetişim **tenant tarafından ayarlanabilir
bir kadrandır.** Varsayılan hafif; kurumsal tenant kısar. Bu aynı zamanda **open-core ayrımıdır**
(hafif = ücretsiz, kısan = paralı).

---

## 4. v2 kapsamı — epic'ler

### E0 — Tenant + RBAC + RLS (TEMEL) 🔴

**Çok-kiracılık:** `Platform → Tenant → Kullanıcı`. Tenant eşleşmesi: Azure tenant id veya
e-posta domain'i (bir tenant'ın **birden çok domain'i** olabilir → `tenant_domains`). Her satır
`tenant_id` taşır; izolasyon **RLS ile** zorlanır.

**Bireysel + self-serve (SG serisi):** Tenant üyeliği domain zorunluluğu **gerektirmez.**
Kurumsal kullanıcı domain/Azure eşleşmesiyle otomatik katılır; bireysel kullanıcı (Gmail/Hotmail
dahil) arayüzden **kendi çalışma alanını (tenant) açabilir** — domain opsiyonel, kurucu
`tenant_admin` olur — ya da davet koduyla mevcut bir tenant'a katılır. Tenant kaydı elle SQL
yerine `/register` akışıyla yapılır. Ayrıntı: Sprint Planı D1 + SG1–SG3.

**Roller** (sistem varsayılanı — tenant düzenleyebilir):

| Rol | Ne yapar |
|---|---|
| `platform_owner` | DuoSis. Tenant açar, her şeyi görür. |
| `tenant_admin` | Kendi tenant'ında her şey; **rolleri/izinleri düzenler**; yönetişim kadranı. |
| `moderator` | İçerik moderasyonu, gizleme, bayrak inceleme, oy görünürlüğü. |
| `organizer` | Hackathon/etkinlik açabilir. |
| `jury` | **Sepet bazlı** rol; puanlar. |
| `member` | Katılır, fikir atar, oy verir. |
| `spectator` | İzler; yazamaz, oy veremez. |

**İzin kataloğu** (kodda sabit): `hackathon.create` · `etkinlik.create` · `pool.create` ·
`pool.promote` · `content.moderate` · `vote.view_all` · `archive.view_all` · `analytics.view` ·
`tenant.manage_roles` · `tenant.manage_settings` · `hackathon.jury` · `hackathon.manage` ·
`platform.manage_tenants` (yalnızca `platform_owner` — SG3: cross-tenant yönetim)

**RLS:** tüm tablolarda. İzin kontrolü **sunucuda** (RLS + route handler); istemci sadece UI.

**Kabul:** A tenant'ının kullanıcısı, anon key ve devtools ile bile B tenant'ının hiçbir satırını
okuyamıyor. `organizer` izni olmayan hackathon açamıyor — buton gizli **ve** API reddediyor.

### E1 — Kavanoz (Fikir Deposu) 🔴

Tenant seviyesinde kalıcı fikir havuzu. **Kapsam: hepsi** — hackathon konusu, etkinlik fikri,
ofis talebi, ürün fikri.

- Fikir ekle: metin + **brief** + **kategori** + sahip. Her an, her gün.
- **Poll:** kavanozda süreli oylama; **katılımcı yeni seçenek ekleyebilir**, oylanır.
- Liste: kategori filtresi, arama, oy sayısı, durum rozeti.
- Durumlar: `yeni → oylanıyor → organize edildi → arşiv` (+ `reddedildi`).
- **Dönüştür:** fikir(ler) → Hackathon (ana hat) **veya** Etkinlik (yan dal). `promoted_basket_id`.
- **Geri akış:** kazanmayan fikir → "Kavanoza at" (`source_basket_id`). **Fikir birikimi burada oluşur.**

**Kabul:** Kavanozdan fikir seçip hackathon başlatabiliyorum; hackathon bitince kavanozun o
satırında "→ Hackathon #12'de kullanıldı, kazanan: X takımı" görünüyor.

### E2 — ★ İmza an: çekiliş + dağıtım 🔴

**Ürünün ruhu.** Varlık hazır (`RaffleReveal.tsx`), yanlış yere bağlı — taşı.

- **Fikir çekimi:** `IdeaStage`'deki çıplak `Math.random()` yerine `RaffleReveal`. Shuffle →
  yavaşlama → kilitlenme → reveal + **confetti** (paket kurulu, kullanılmamış).
- **Dağıtım çekimi:** takım↔fikir eşleşmesi de çekilişle sahnelenir.
- **`ideaAssignment` modları:**
  - `same` — fikri atan takım yapar.
  - `cross` ← **yeni:** *başkasının fikrini başkası yapar.* Kura ile çapraz atama.
    Hem eğlenceli hem "ekipleri kaynaştırmak" hedefine doğrudan hizmet ediyor; çekiliş anına
    gerçek bahis ekliyor ("kimin fikri kime düştü?").
  - `manual` — elle.
- **Birden fazla fikir** (`ideaCount`): N fikir, takımlara dağıtılır. `1` = bugünkü davranış;
  tek fikirde takımlar doğal olarak **farklı yorumlar** üretir (takım "açısını" beyan edebilir).
- **Geçilebilir:** çekiliş ekranı her zaman istenmez → atla butonu + `prefers-reduced-motion`
  desteği (kodda desen zaten planlanmış).

**Kabul:** Kavanozdan fikir çekilirken shuffle→reveal→confetti akıyor; `cross` modunda kimin
fikrinin kime düştüğü sahneleniyor; atla butonu tek tıkla geçiyor; reduced-motion'da animasyon yok.

### E3 — Sonuç / Arşiv 🔴

*"Bitince kim vardı, ne oldu, ne oy vardı — bunun tablosu."*

- Biten her sepet için kalıcı sonuç sayfası: katılımcılar, takımlar, fikirler, skor kırılımı,
  kazanan, feedback, süre. Her sepet tipi için çalışır.
- Arşiv listesi: filtre, arama. Kapsam `archive.view_all` iznine göre. CSV export.

### E4 — Puanlama (kategori + yıldız) 🔴

Standart kategori kütüphanesi biz tanımlarız, **kullanıcı seçer**. Basitlik korunur.

- **Kütüphane** (kodda sabit): `coding` Kod kalitesi · `ui` Arayüz · `tech` Teknoloji ·
  `usability` Kullanılabilirlik · `impact` Etki/değer · `innovation` Yenilikçilik ·
  `completeness` Tamamlanmışlık · `presentation` Sunum · `subjective` Öznel.
- Admin ~5 seçer (varsayılan hazır gelir) + `subjective` + **en fazla 2 özel** kategori.
- Her oy veren, her takımı **her kategoride 1–5 yıldız** puanlar. Skor = ağırlıklı toplam.
- **Jüri ağırlığı:** `juryEnabled` + `juryWeight`; `scores.is_jury`.
- **Geriye uyum:** `scoringMode: 'simple' | 'rubric'`; varsayılan `simple`.

**Kabul:** Skorboard kategori kırılımını gösteriyor; "neden kazandı" tablodan okunuyor.
**Basitlik testi: kurulum 3 tıkta bitiyor.**

### E5 — ★ Analitik huni 🔴 — *paralı katmanın ürünü ve kapının vitrini*

**Bu epic iki işi birden yapıyor.** Ölçtüğümüz şey bir huni:

```
fikir girildi → oylandı/seçildi → organizasyona dönüştü → yapıldı → ÜRETİME ALINDI
```

Son kutu para kutusu. Ve **aynı huni iki uçtan okunuyor:**

| Kim | Ne görüyor |
|---|---|
| **Müşteri şirket** | "Ekibimiz katılıyor ve iş çıkarıyor. 3 fikir üretime alındı." |
| **Biz (DuoSis)** | "Bu şirkette 3 fikir işe dönüştü → bu işin saatini kim tutuyor?" → **Hermes konuşması** |

Bir kez inşa, iki türlü çerçeve — Hermes'in "tek kod, iki konumlandırma" deseni.

- **Huni ekranı:** her aşamada sayı + dönüşüm oranı.
- **Üretime alınanlar listesi:** ne yapıldı, kim yaptı, tahmini efor. ← Hermes köprüsünün yeri
  hazırlanıyor; entegrasyon yokken bile kapı gösterilebiliyor.
- **Katılım trendi:** aylık aktif katılımcı; **3. ay sürdürülen katılım metriği** öne çıkar
  (kategorinin battığı yer; bizim tek başarı ölçütümüz).
- **Teaser:** ücretsiz katmanda özet görünür ("Son 3 etkinlikte katılım %64"), detay paralı.
  **Duvar değil, iştah.**

**Kabul:** Huni doğru sayıyor; üretime alınanlar listesi dolu; 3. ay katılım metriği hesaplanıyor;
ücretsiz katmanda teaser görünüyor, detay `analytics.view` istiyor.

### E6 — Moderasyon + denetim 🟡

- **Kural listesi:** tenant admin kelime/desen listesi; kural başına `uyar` (varsayılan) / `engelle`.
- **Uyarı akışı:** *"Metninde şu kelimeler geçiyor. Göndermek istediğine emin misin?"*
- **Moderatör kuyruğu:** bayraklı içerik → onayla / gizle. **Denetim kaydı** (`audit_log`).
- **Oy görünürlüğü:** anonim oy yok; görünürlük `vote.view_all` ile sınırlı.

> **Bugünkü durum tersine bozuk:** `votes.voter` e-posta tutuyor ve RLS kapalı — oylar şu an
> **herkese** açık. İstenen "üst kademe görsün" değil, **"sadece üst kademe görsün"**.

### E7 — Proje bazlı feedback 🟡
`feedback.team_id`/`idea_id` zaten var, UI kullanmıyor. Bağla. Puan verirken o projeye özel yorum;
takım kendi feedback'ini toplu görür; sonuç sayfasında proje başına liste.

### E8 — Lobi kontrolü + davet 🟡
- `lobbyPolicy: 'open' | 'approval'`; kilit (`phase != lobby` → katılım kapalı), `allowLateJoin`.
- **Fikir belli / belli değil:** lobide katılımcı fikrin durumunu görsün (bugün sadece "bekle").
- **Pop-up isim görünümü:** avatara dokun → isim popover.
- **Davet:** WhatsApp linki + QR. **Bu zenginleştirme değil, viral mekanik** — altyapı
  `InvitePanel.tsx`'te hazır, Etkinlik'e de bağlanır.

### E9 — Üç tab 🟢
**Kavanoz · Hackathon · Etkinlik** — bu sırada. Sıra ağırlığı yansıtır: Etkinlik sonuncu ve daha
hafif durur. Aralarında geçiş kolay, bağlam kaybolmaz.

---

## 5. Kapsam dışı (v2'ye girmez)

- **Etkinlik zenginleştirme** — tarih modları, lokasyon, brief, fikir toplama süresi. Etkinlik
  bugünkü haliyle kalır (yan dal). *Davet/QR hariç — o E8'de.*
- **Hackathon zamanlama** (ileri tarihli) ve **seyirci modu** — sonraya.
- **Hermes entegrasyonu** — sonraya. Yeri E5'te hazırlanıyor (üretime alınanlar + efor), o yüzden
  ertelemek maliyetsiz. Hermes mikroservis: `auth`/`core`/`reporting`; dışa REST verip vermediği
  bilinmiyor — başlamadan **spike** gerekir.
- **"Kişilerime erişim"** — rehber okuma. KVKK'lı kişisel veri + izin akışı; WhatsApp link + QR
  aynı işi izinsiz görüyor.
- **Slack/Teams entegrasyonu** — v2.1. (Kategorinin en bilinen dersi: insanı zaten çalıştığı yerde
  yakala. Önemli ama v2 omurgası önce.)
- **Kampanya / challenge** — v2.1. Süreli fikir çağrısı; kavanoz poll'ü bunun hafif hali.
- **AI ile fikir→prototip hattı** — v3. Ürünün asıl farklılaşma adayı; omurga oturmadan başlanmaz.
- **Gerçek ödül/para dağıtımı** — girme. Tanınma (liderlik tablosu, "üretime alındı" statüsü,
  arşivde ad) evet; hediye kartı/bakiye/vergi tesisatı hayır. Ürün ödülü **ilan etsin ve
  kaydetsin**; ödülü şirket kendi versin.

---

## 6. Veri modeli

```sql
-- ── E0: tenant + RBAC ──
create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null, azure_tenant_id text, email_domain text,
  plan text not null default 'free',              -- SG: 'free' | 'analytics'
  status text not null default 'active',          -- SG: 'active' | 'suspended'
  settings jsonb not null default '{}'::jsonb,    -- yönetişim kadranı
  created_at timestamptz default now()
);
-- SG: bir tenant'ın birden çok domain'i olabilir (bireysel tenant'ta boş kalabilir)
create table tenant_domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  domain text not null unique,
  created_at timestamptz default now()
);
create table app_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id text not null, email text, display_name text,
  created_at timestamptz default now(), unique (tenant_id, user_id)
);
create table roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,  -- null = sistem rolü
  key text not null, label text not null, is_system boolean not null default false,
  unique (tenant_id, key)
);
create table role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission_key text not null, unique (role_id, permission_key)
);
create table user_roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id text not null,
  role_id uuid not null references roles(id) on delete cascade,
  scope_basket_id uuid references baskets(id) on delete cascade,  -- null = global; jüri için dolu
  unique (tenant_id, user_id, role_id, scope_basket_id)
);

-- ── E1: kavanoz ──
create table idea_pool (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  text text not null, brief text, category text,
  track_hint text,                                -- 'hackathon' | 'etkinlik' | null
  status text not null default 'new',             -- 'new'|'voting'|'promoted'|'archived'|'rejected'
  hidden boolean not null default false,
  created_by text not null, vote_count int not null default 0,
  promoted_basket_id uuid references baskets(id) on delete set null,
  source_basket_id uuid references baskets(id) on delete set null,   -- geri akış
  poll_closes_at timestamptz,                     -- kavanoz poll'ü süreliyse
  created_at timestamptz default now()
);
create table pool_votes (
  id uuid primary key default gen_random_uuid(),
  pool_idea_id uuid not null references idea_pool(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  voter text not null, created_at timestamptz default now(),
  unique (pool_idea_id, voter)
);

-- ── E4: rubrik puanlama ──
create table scores (
  id uuid primary key default gen_random_uuid(),
  basket_id uuid not null references baskets(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  voter text not null, category_key text not null,
  stars int not null check (stars between 1 and 5),
  is_jury boolean not null default false,
  created_at timestamptz default now(),
  unique (basket_id, team_id, voter, category_key)
);

-- ── E6: moderasyon ──
create table content_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  pattern text not null, kind text not null default 'word',   -- 'word'|'regex'
  action text not null default 'warn',                        -- 'warn'|'block'
  created_at timestamptz default now()
);
create table content_flags (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  entity_type text not null, entity_id uuid not null,
  rule_id uuid references content_rules(id) on delete set null,
  status text not null default 'pending',                     -- 'pending'|'approved'|'hidden'
  reviewed_by text, created_at timestamptz default now()
);
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  actor text not null, action text not null,
  entity_type text, entity_id uuid,
  meta jsonb not null default '{}'::jsonb, created_at timestamptz default now()
);

-- ── E2: takım ↔ fikir (çekiliş/dağıtım) ──
alter table teams add column idea_id uuid references ideas(id) on delete set null;
alter table teams add column angle text;          -- tek fikirde takımın "açısı"

-- ── E5: analitik huni ──
alter table baskets add column production_note text;      -- üretime alındıysa: ne, kim
alter table baskets add column effort_estimate numeric;   -- tahmini adam-gün → Hermes köprüsü

-- ── E8 / mevcut tablolara tenant_id ──
alter table baskets add column lobby_locked boolean not null default false;
alter table hackathon_participants add column approved boolean not null default true;
alter table baskets add column tenant_id uuid references tenants(id) on delete cascade;
-- aynısı: ideas, votes, teams, team_members, team_votes, feedback,
--         hackathon_participants, squad_members

-- realtime publication: idea_pool, pool_votes, scores
-- RLS: TÜM tablolarda AÇILIR (E0) — politikalar tenant_id + rol/izin üzerinden
```

**Config şeması** (`baskets.config jsonb`):

```ts
type HackathonConfig = {
  // mevcut
  ideaSource?: "static" | "pool" | "repo";        // 'repo' → kavanozdan
  poolSelect?: "vote" | "random";
  teamMode?: "solo" | "groups" | "one";
  groups?: { count: number; size: number; assignment: "random" | "manual" };
  duration?: { value: number; unit: "hour" | "day" | "week" };

  // v2
  ideaCount?: number;                                    // E2 — kaç fikir paralel
  ideaAssignment?: "same" | "cross" | "manual";          // E2 — 'cross' = başkasının fikri
  revealAnimation?: boolean;                             // E2 — çekiliş sahnesi (varsayılan true)
  scoringMode?: "simple" | "rubric";                     // E4
  rubric?: { key: string; label: string; weight: number }[];
  juryEnabled?: boolean; juryWeight?: number;            // E4 + E0
  lobbyPolicy?: "open" | "approval"; allowLateJoin?: boolean;  // E8
  visibility?: "tenant" | "participants";
};
```

**Tenant yönetişim kadranı** (`tenants.settings jsonb`):

```ts
type TenantSettings = {
  moderation?: "off" | "warn" | "review";          // varsayılan: "warn"
  voteVisibility?: "all" | "moderators";           // varsayılan: "moderators"
  whoCanCreateHackathon?: "everyone" | "organizers";  // varsayılan: "organizers"
  whoCanCreateEvent?: "everyone" | "organizers";      // varsayılan: "everyone"
  whoCanPostToPool?: "everyone" | "members";          // varsayılan: "everyone"
};
```

---

## 7. Ajan için notlar

- **E0'ı yarım yapma.** RBAC'ı RLS olmadan sevk etmek güvenlik yanılsaması üretir — istemci
  tarafı rol kontrolü anon key'le aşılır. İzin kontrolü **sunucuda**.
- **İmza anı yeniden yazma:** `RaffleReveal.tsx` çalışıyor. **Taşı**, kopyalama, yeniden icat etme.
- **Mimariyi bozma:** `contract.ts` → `StageDef`. Yeni aşama = registry'ye satır.
  `if config.x else` dallanması **yasak** — config modül *seçer*.
- **Realtime primitifini yeniden yazma:** `lib/useRealtimeVotes.ts` optimistic + reconnect +
  fallback polling'i çözmüş. Kavanoz oyu ve skorlar **aynı deseni** kullanır. **Dikkat:** RLS
  açılınca realtime abonelikleri de politikaya tabi olur — test et.
- **Basitlik testi (E4):** rubrik kurulumu 3 tıkta bitmeli. Varsayılan seti hazır getir.
- **Yönetişim varsayılanı hafif.** Kurumsal tenant kısar; iç kullanımda ürün eğlenceli kalır.
- **Hızlı yol korunur:** kavanoza uğramadan sepet açılabilmeli. Regresyon testidir.
- **Etkinlik'e dokunma:** yan dal, bugünkü hali korunuyor (davet hariç). Zenginleştirme kapsam dışı.
- **Geriye uyum:** config alanları opsiyonel; yoksa varsayılan.
- **Migration idempotent** (`create table if not exists`, `do $$ … exception`). **Veri kaybı sıfır.**
- **Tasarım:** `DESIGN-SYSTEM.md` zorunlu. Kavanoz için yeni aksan gerekirse **önce** oraya ekle.

---

## 8. Açık kararlar (Duo'dan)

1. **Standart kategori kütüphanesi** — E4'teki 9'luk liste ve varsayılan 5'li set onaylanıyor mu?
2. **Tenant tanımı** — bir müşteri şirket = bir tenant. Alt birim (departman) ihtiyacı var mı?
   (Öneri: düz; LogiSlot'taki `Facility` katmanının karşılığı burada yok.)

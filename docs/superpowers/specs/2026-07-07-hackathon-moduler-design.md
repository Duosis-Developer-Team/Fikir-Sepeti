# Hackathon — Modüler Monolit Tasarım

**Tarih:** 2026-07-07
**Durum:** Onaylandı (mimari), uygulama başlıyor
**Kapsam:** `build` modunun `hackathon` olarak modüler, config-driven bir pipeline'a dönüşmesi + doğrudan Azure (Entra ID) auth + `social`→`etkinlik` yeniden adlandırma + demo/mock verinin temizliği.

---

## 1. Hedefler

1. **Doğrudan Azure girişi** — localStorage isim-gate tamamen kalkar. Kimlik = iş e-postası (Entra ID). Yönetici onayı gerektiren erişim kapısı (allowlist) opsiyonel 2. faz.
2. **`build` → `hackathon`, `social` → `etkinlik`** (tip değeri + tüm UI etiketleri).
3. **Elemesiz, yalın hackathon akışı** — mevcut 6-fazlı (Fikir→Finalist→Demo→Oylama→Squad) akış çöpe atılan demolar ürettiği için kaldırılır. Takımlar yapımdan **önce** kurulur.
4. **Modüler monolit mimari** — `if fikir_var else pool...` dallanması YOK. Her aşama config'e göre seçilen bağımsız bir modül; orchestrator sadece modülleri dizer.
5. **Mock/demo veri temizliği** — sadece gerçek kullanıcı verisi.

**YAGNI:** Gerçek mikroservis (ayrı deploy) YAPILMAZ — 10-20 kişilik iç araçta fazla mühendislik. Modüler monolit = aynı bağımsızlık, doğru maliyet.

---

## 2. Akış (sabit iskelet)

```
Admin = hackathon'u açan kişi   → diğerleri LOBİDE bekler
   │
   ▼  FİKİR KAYNAĞI (admin config)
   ├─ static : admin fikri girer
   └─ pool   : herkes yazar → seçim: vote | random → 1 fikir
   │
   ▼  TAKIM MODU (admin config)
   ├─ solo   : herkes tek
   ├─ groups : N takım × M kişi → atama: random | manual
   └─ one    : tek komple takım (herkes birlikte)
   │
   ▼  DEMO      : sırayla hızlı MVP demo + skorboard canlı oy (en iyi yapım)
   ▼  FEEDBACK  : eleştiri / yorum
   ▼  PRODUCTION: kazanan "üretime alındı" statüsü
```

Faz makinesi (hackathon `phase` değerleri):
`lobby → idea → team → demo → feedback → production → done`

Admin fazları ileri alır; her modül `canAdvance()` ile hazır olup olmadığını bildirir.

---

## 3. Config şeması

Hackathon satırında `config jsonb` olarak saklanır. Kod dallanmaz; config hangi modülün çalışacağını **seçer**.

```ts
type HackathonConfig = {
  ideaSource: "static" | "pool";
  poolSelect?: "vote" | "random";        // ideaSource === "pool" ise
  teamMode: "solo" | "groups" | "one";
  groups?: {                             // teamMode === "groups" ise
    count: number;                       // kaç takım
    size: number;                        // hedef kişi/takım
    assignment: "random" | "manual";
  };
};
```

Örnek: `{ ideaSource: "pool", poolSelect: "vote", teamMode: "groups", groups: { count: 3, size: 4, assignment: "random" } }`

---

## 4. Modül sözleşmesi (mimarinin kalbi)

Her aşama tek bir arayüze uyar. Orchestrator modülün **içini bilmez**.

```ts
type StageKey = "lobby" | "idea" | "team" | "demo" | "feedback" | "production";

type StageContext = {
  hackathon: Hackathon;          // baskets satırı + config
  config: HackathonConfig;
  user: SessionUser;             // Azure kimliği (id, email, ad)
  isAdmin: boolean;              // user.id === hackathon.created_by
  refresh: () => void;
};

type StageModule = {
  key: StageKey;
  label: string;
  View: React.FC<StageContext>;        // katılımcı görünümü
  AdminBar?: React.FC<StageContext>;   // admin kontrolleri (config/advance)
  canAdvance: (ctx: StageContext) => boolean;   // admin ileri alabilir mi
};
```

**Strateji alt-modülleri** (config ile seçilir, üst modül dallanmaz):

- `idea` aşaması → `IDEA_STRATEGIES: Record<ideaSource, StrategyModule>`
  - `static` → `StaticIdea`
  - `pool` → `PoolIdea`  (içinde `POOL_SELECT: Record<poolSelect, ...>` → `VoteSelect | RandomSelect`)
- `team` aşaması → `TEAM_STRATEGIES: Record<teamMode, StrategyModule>`
  - `solo` → `SoloTeams`
  - `groups` → `GroupTeams` (içinde `ASSIGN: Record<assignment, ...>` → `RandomAssign | ManualAssign`)
  - `one` → `OneTeam`

**Orchestrator** (`HackathonRunner`):
```
STAGES: Record<StageKey, StageModule>
render:  STAGES[hackathon.phase].View  (+ isAdmin ? AdminBar)
advance: canAdvance() → setPhase(next)
```
Yeni aşama/strateji eklemek = registry'ye bir satır; başka dosya değişmez.

---

## 5. Veri modeli

Mevcut: `baskets`, `ideas`, `votes`, `squad_members`. Değişiklikler:

**`baskets`**
- `type` değerleri: `social`→`etkinlik`, `build`→`hackathon` (veri migration'ı).
- `+ config jsonb default '{}'` — hackathon konfigürasyonu.
- `+ selected_idea_id uuid` — pool/static ile seçilen fikir (kazanan ≠ seçilen; kazanan demo sonrası).

**Yeni tablolar**
```sql
hackathon_participants(
  id, basket_id, user_id text, email text, display_name text,
  role text default 'member',        -- 'admin' | 'member'
  joined_at, unique(basket_id, user_id))

teams(
  id, basket_id, name text, created_at)

team_members(
  id, team_id, basket_id, user_id text,
  unique(team_id, user_id))

feedback(
  id, basket_id, team_id uuid null, idea_id uuid null,
  author_id text, author_name text, text text, created_at)
```

**Yeniden kullanılan:** `ideas` (pool fikirleri + demo kartı; `presenter`/`demo_url`/`tag` demo aşamasında), `votes` (faz-scoped; pool seçim oyu + demo oyu), `squad_members` → `team_members` ile emekli.

**Kimlik taşıması:** `created_by`, `voter`, participants → Azure `user_id` (email). Eski `text` isim yerine e-posta.

RLS: kapalı (iç araç, mevcut desenle uyumlu). Realtime publication'a yeni tablolar eklenir.

---

## 6. Auth — doğrudan Azure (Entra ID)

- Supabase Auth **Azure (Entra ID) OAuth** provider.
- `NameGate` → `AuthGate`: `supabase.auth.getSession()`; oturum yoksa "İş e-postanla giriş yap" → `supabase.auth.signInWithOAuth({ provider: 'azure', options: { scopes: 'email openid profile' } })`.
- `useNameContext()` yerine `useSession()` → `{ id, email, name }`.
- **Yöneticiden gereken** (bu olmadan giriş çalışmaz):
  1. Azure AD **app registration**: Tenant ID, Client ID, Client Secret.
  2. Redirect URI: `https://ygpqvdqcvnkyofvnjonk.supabase.co/auth/v1/callback`.
  3. Supabase Dashboard → Auth → Providers → Azure: enable + creds.
- **Yönetici onayı (2. faz, opsiyonel):** `profiles.approved boolean` allowlist; onaysız kullanıcı bekleme ekranı görür.

**Sıralama riski:** Azure creds gelene kadar giriş yapılamaz. O yüzden auth kodu hazır kurulur, provider creds gelince flip edilir; bu arada geliştirme için geçici bypass flag'i (`NEXT_PUBLIC_AUTH_BYPASS`) sadece local'de.

---

## 7. Uygulama sırası

1. DB migration (config, rename, yeni tablolar, realtime) — foundation.
2. Rename UI (`social`→Etkinlik, `build`→Hackathon) + demo/seed temizliği.
3. Azure `AuthGate` + session (bypass flag ile local çalışır).
4. Orchestrator + modül sözleşmesi + registry iskeleti.
5. Modüller: Lobi → Fikir(Static/Pool) → Takım(Solo/Groups/One) → Demo(skorboard reuse) → Feedback → Production.
6. Admin config paneli (lobide) + faz ilerletme.

Her adım tek başına derlenip commit edilir.

---

## 8. Modül izolasyon kontrolü

Her modül için cevaplanabilmeli: **ne yapar / nasıl kullanılır / neye bağlı.**
- Orchestrator ↔ modül: sadece `StageModule` arayüzü.
- Modül ↔ DB: kendi tablo(lar)ı üzerinden; başka modülün tablosuna yazmaz.
- Config ↔ kod: davranış config verisiyle seçilir, kaynak kodda dallanmaz.

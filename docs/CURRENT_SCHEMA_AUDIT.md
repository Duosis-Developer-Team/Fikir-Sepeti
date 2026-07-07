# Fikir-Sepeti — Supabase Şema Denetimi

> Kaynak: `supabase/schema.sql` (tek dosya; ayrı migration klasörü yok).
> `lib/types.ts` ile karşılaştırmalı olarak denetlendi. Kod kırılmadı — bu yalnızca gözlem dokümanıdır.

## 1. Tablolar

| Tablo | Alanlar (özet) | Notlar |
|---|---|---|
| `baskets` | `id`, `title`, `type` ('etkinlik'\|'hackathon'), `resolve_method` ('vote'\|'raffle'), `phase`, `status` ('active'\|'resolved'), `winner_idea_id`, `selected_idea_id`, `config jsonb`, `current_demo_idx int`, `created_by text`, `created_at` | Ortak faz alanı `phase`. `config` hackathon modüllerini seçer. |
| `ideas` | `id`, `basket_id → baskets ON DELETE CASCADE`, `text`, `tag`, `is_finalist bool`, `demo_url`, `presenter`, `live_at text`, `created_by text`, `vote_count int`, `created_at` | `vote_count` trigger ile bakımlı. `is_finalist`/`presenter`/`demo_url`/`live_at` yalnızca **legacy** presenter akışında anlamlı (güncel runner kullanmıyor). |
| `votes` | `id`, `idea_id → ideas CASCADE`, `basket_id → baskets CASCADE`, `phase text`, `voter text`, `created_at`, **`unique(basket_id, phase, voter)`** | Sepet+faz başına 1 oy. Trigger `vote_count`'u INSERT/DELETE'te günceller. |
| `squad_members` | `id`, `basket_id CASCADE`, `member text`, `unique(basket_id, member)` | **Legacy** — kodda çağrısız (`addSquadMember`/`listSquad` kullanılmıyor). |
| `hackathon_participants` | `id`, `basket_id CASCADE`, `user_id text` (Azure/e-posta), `email`, `display_name`, `role` ('admin'\|'member'), `joined_at`, `unique(basket_id, user_id)` | Lobi katılımı. `joinLobby` upsert eder. |
| `teams` | `id`, `basket_id CASCADE`, `name`, `created_at` | `rebuildTeams` sıfırdan kurar. |
| `team_members` | `id`, `team_id → teams CASCADE`, `basket_id CASCADE`, `user_id text`, `unique(team_id, user_id)` | |
| `team_votes` | `id`, `team_id CASCADE`, `basket_id CASCADE`, `voter text`, `created_at`, **`unique(basket_id, voter)`** | Demo fazı: kişi başı 1 oy (değiştirilebilir; `voteTeam` sil+ekle). |
| `feedback` | `id`, `basket_id CASCADE`, `team_id → teams CASCADE (null)`, `idea_id → ideas CASCADE (null)`, `author_id`, `author_name`, `text`, `created_at` | Feedback fazı. |

## 2. Trigger'lar

- **`bump_vote_count()`** + `vote_count_trigger` (`votes` üzerinde `AFTER INSERT OR DELETE`): `ideas.vote_count` +/- 1.
  - ⚠️ **UPDATE ele alınmıyor** (bilinçli): oy değiştirmede kod eski satırı silip yenisini ekler (delete → insert), böylece trigger iki kez tetiklenir ve sayaç doğru kalır. Doğrudan `votes` UPDATE'i sayaç bozardı — kodda böyle bir yol yok.
  - ⚠️ `team_votes` için sayaç trigger'ı **yok**; takım oyları client tarafında `listTeamVotes` ile sayılır.

## 3. Realtime publication

`schema.sql` sonunda idempotent `do $$ ... $$` bloğu şu tabloları `supabase_realtime` publication'a ekler:
`votes`, `ideas`, `baskets`, `hackathon_participants`, `teams`, `team_members`, `team_votes`, `feedback`.
- ✅ Koddaki tüm realtime kanallarının dinlediği tablolar publication'da mevcut.
- ⚠️ `squad_members` publication'da **yok** (zaten legacy/çağrısız — sorun değil).

## 4. RLS (Row Level Security)

**Tüm tablolarda RLS açıkça KAPALI** (`alter table ... disable row level security`).
- Bağlam: iç araç + demo. `NEXT_PUBLIC_SUPABASE_ANON_KEY` ile herkes tüm tabloları okuyup yazabilir.
- **Risk:** İnternete açık prod için kabul edilemez; iç ağ/demo için CTO tarafından kabul edilmiş görünüyor (`CLAUDE.md`: "RLS kapalı (iç araç, demo)").
- **Öneri (sprint dışı, CTO onayı gerekir):** en azından `basket_id` bazlı yazma politikaları veya auth'lu RLS; DEVELOPMENT_RULES bunu "RLS prod güvenlik revizyonu" olarak sprint dışına almış.

## 5. Seed / demo verisi

- `supabase/` içinde **seed dosyası yok**. `CLAUDE.md`: "Demo verisi Supabase'de hazır (2 sosyal + 1 build voting)" — yani seed **repo'da değil, uzak Supabase projesinde** manuel. Yeni bir Supabase projesi kuran geliştirici demo veriyi elle oluşturmalı.
- **Öneri:** `supabase/seed.sql` eklenerek reproducible demo kurulumu sağlanabilir (sonraki sprint).

## 6. `types.ts` ↔ şema uyumu

Genelde **uyumlu**. Tespitler:

| Konu | Şema | `types.ts` | Değerlendirme |
|---|---|---|---|
| `Basket.config` | `jsonb default '{}'` | `HackathonConfig` (tüm alanlar opsiyonel) | ✅ Uyumlu; boş `{}` geçerli. |
| `Basket.current_demo_idx` | `int default 0` | `number` | ✅ |
| `Idea.live_at` | `text` (timestamp değil) | `string \| null` | ✅ ama semantik tuhaf (tarih metin olarak). Legacy. |
| `Phase` birleşimi | Yorumda listelenmiş, kolon `text` (kısıtsız) | 9 değerli union | ⚠️ DB'de **CHECK constraint yok** — geçersiz faz string'i DB'ye yazılabilir. Tip yalnızca derleme zamanı korur. |
| `type`/`resolve_method`/`status`/`role` | hepsi `text` (CHECK yok) | union tipler | ⚠️ Aynı: DB seviyesinde enum/CHECK yok. |
| `votes.phase` | `text default 'ideas'` | `VoteRow.phase: Phase` | ⚠️ `scripts/stress.mjs` `phase: "voting"` yazıyor — `Phase` union'ında **olmayan** bir değer; stale script. |

## 7. Migration stratejisi (mevcut durum)

- **Migration sistemi yok** — tek `schema.sql`, elle çalıştırılıyor. `CREATE TABLE IF NOT EXISTS` sayesinde idempotent ama versiyonlama/rollback yok.
- **Öneri (sprint dışı):** şema değişirse `supabase/migrations/NNNN_*.sql` düzenine geçilmeli; her değişiklik geriye-dönük etki notuyla belgelenmeli (DEVELOPMENT_RULES §4).

## 8. Özet — şema riskleri

1. **RLS kapalı** — prod güvenlik borcu (bilinçli, iç araç).
2. **DB seviyesinde enum/CHECK yok** — `phase`/`type`/`status` serbest metin; geçersiz değer yazılabilir.
3. **Seed repo'da yok** — yeni kurulum demo verisi elle.
4. **Legacy kolonlar** (`ideas.is_finalist/presenter/demo_url/live_at`, `squad_members` tablosu) güncel akışta kullanılmıyor.
5. **Migration/versiyonlama yok** — tek elle-çalıştırılan `schema.sql`.

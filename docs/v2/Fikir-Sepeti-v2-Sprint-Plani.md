# Fikir Sepeti — v2 Sprint Planı

**Tarih:** 14 Temmuz 2026 · **Revizyon:** 2 (kimlik + odak revizyonu)
**Bağlı doküman:** `Fikir-Sepeti-v2-Proje-Plani.md` (kapsam, mimari, veri modeli)
**Yönetim:** `Fikir-Sepeti-v2-Sprint-Yonetimi.md` (ilerleme protokolü, kapı kuralları)

> **Zaman tahmini yok — bilinçli.** İşi AI ajanı yapacak; darboğaz süre değil, **doğrulama**.
> Her sprint bir **çıkış kapısıyla** biter: kapı geçilmeden sonraki sprint başlamaz.
> Ajan duraksamadan ilerler, sadece kapılarda durur.

**v2'nin hedefi:** Gösterilebilir bir prototip — **çalışan + güvenli + eğlenceli + ölçen.**
Ve gösterirken "bu bize ne kazandırıyor"un ekranda görünmesi (S8).

---

## Sprint haritası

| # | Sprint | Neden bu sırada | Duo kapısı |
|---|---|---|---|
| **S0** | Test zemini + CI kapısı | Kapılar olmadan plan uygulanamaz | — |
| **S1** | Tenant modeli + veri taşıma | Her tablo etkilenir; en dipte | — |
| **S2** | RBAC: rol, izin, sunucu zorlaması | Tenant üstüne oturur | — |
| **S3** | RLS: izolasyon + realtime | RBAC'ı gerçek yapan kat | ✅ **güvenlik** |
| **S4** | Kavanoz (Fikir Deposu) + üç tab | Ürünün omurgası | — |
| **S5** | Sonuç / Arşiv | Analitiğin girdisi; erken yap | ✅ **omurga** |
| **S6** | ★ İmza an: çekiliş + dağıtım | Ürünün ruhu; varlık hazır, taşınacak | — |
| **S7** | Puanlama (rubrik + jüri) | Hackathon'u tamamlar | ✅ **basitlik** |
| **D1** | ★ Production yayın | Mevcut kod canlıda çalışmalı; öncelik | — |
| **SG1** | Landing + giriş noktaları | Dış kapı: ürünü anlatır, sisteme yönlendirir | — |
| **SG2** | Kayıt + self-serve tenant | Elle SQL yerine arayüzden çalışma alanı | — |
| **SG3** | Platform yönetim paneli | SaaS omurgası: tenant'ları yönet | — |
| **S8** | ★ Analitik huni | Paralı katmanın ürünü **ve kapının vitrini** | ✅ **kapı** |
| **S9** | Moderasyon + denetim | Kurumsal katman | — |
| **S10** | Proje bazlı feedback | Küçük; kolonlar hazır | — |
| **S11** | Lobi kontrolü + davet | Davet = viral mekanik | — |

**SG serisi neden burada:** S7 sonrası ürün iç araç olarak tam; **SaaS'a açılmak** (landing →
kayıt → self-serve tenant → platform yönetimi) analitik huniden (S8) önce gelir çünkü huninin
"müşteriye açsam" sınavı ancak dışarıdan kayıt olan gerçek tenant'larla anlamlı.

**Kesme noktası:** S8'den sonra durulabilir — o noktada ürün **gösterilebilir**: çalışıyor,
güvenli, eğlenceli ve kapıyı ekranda kanıtlıyor. S9–S11 değer katar, tutarlılığı bozmaz.

**Bu revizyonda kesilenler:** Etkinlik zenginleştirme (tarih/lokasyon/brief/süre — davet hariç,
o S11'de), hackathon zamanlama, seyirci modu. Gerekçe: prototipi "satılabilir göstermek" için
gerekmiyor; Etkinlik bugünkü haliyle yan dal olarak yeterli.

---

## S0 — Test zemini + CI kapısı

**Amaç:** Sonraki her sprintin kapısını *otomatik* doğrulanabilir kılmak.

**Neden ilk:** Repoda **hiç test yok** (Playwright kurulu ama tek dosya yok, config yok).
CI yalnızca Vercel'e deploy ediyor — lint yok, build kontrolü yok, test yok; `main`'e push
doğrudan production'a gidiyor. Bu haliyle her kapı "ajan çalıştığını söyledi"ye düşer ve
S1–S3'teki migration'lar denetimsiz production'a akar.

**Kapsam**
1. `playwright.config.ts` + `tests/` iskeleti.
2. **Test veritabanı:** Supabase CLI ile yerel Postgres (`supabase start`) — deterministik, CI'da çalışır.
3. **Seed script:** `scripts/seed.mjs` — sabit UUID'ler, iki tenant, roller, örnek sepetler.
4. **Duman testleri:** mevcut davranışı kilitler — etkinlik: fikir ekle → oy → sonuç;
   hackathon: lobby → idea → team → demo.
5. **CI kapısı:** `.github/workflows/ci.yml` — `lint → build → playwright`.
   **Deploy workflow'u CI'ya bağlanır:** testler geçmeden production'a deploy **yok**.
6. Auth bypass'ın test ortamında çalıştığını doğrula (`NEXT_PUBLIC_AUTH_BYPASS`).

**Çıkış kapısı**
- [ ] `npm run lint` temiz, `npm run build` başarılı.
- [ ] `npx playwright test` yerelde ve CI'da yeşil.
- [ ] Smoke testleri **mevcut** iki akışı uçtan uca doğruluyor.
- [ ] Testler kırmızıyken deploy workflow'u **çalışmıyor** (bilerek kır, doğrula, geri al).

---

## S1 — Tenant modeli + veri taşıma

**Amaç:** `Platform → Tenant → Kullanıcı`; her satır bir tenant'a ait.
**Giriş koşulu:** S0 kapısı geçti.

**Kapsam**
1. `tenants`, `app_users` tabloları.
2. **Tüm mevcut tablolara `tenant_id`:** `baskets`, `ideas`, `votes`, `teams`, `team_members`,
   `team_votes`, `feedback`, `hackathon_participants`, `squad_members`.
3. **Backfill migration:** varsayılan tenant ("DuoSis"); mevcut satırlar ona bağlanır; mevcut
   kullanıcılar `app_users`'a taşınır. **Veri kaybı sıfır.**
4. **Tenant çözümleme:** Azure tenant id / e-posta domain'i → tenant. Eşleşme yoksa: reddet.
5. `tenant_id` sorgulara eklenir (henüz RLS yok — uygulama katmanında filtre).

**Çıkış kapısı**
- [ ] Migration idempotent; iki kez çalışınca bozulmuyor.
- [ ] **Mevcut uygulama aynen çalışıyor** — S0 smoke testleri yeşil.
- [ ] `tenant_id` NULL olan satır **yok** (test sorgusu ile kanıtla).
- [ ] İki tenant'lı seed'de A, B'nin sepetlerini görmüyor.

---

## S2 — RBAC: rol, izin, sunucu zorlaması

**Amaç:** Kim ne yapabilir — modelle ve **sunucuda** zorla.
**Giriş koşulu:** S1 kapısı geçti.

**Kapsam**
1. `roles`, `role_permissions`, `user_roles`.
2. **İzin kataloğu** kodda sabit (proje planı §4/E0 — `analytics.view` dahil).
3. **Sistem rolleri** + varsayılan izin matrisi: `platform_owner` · `tenant_admin` · `moderator` ·
   `organizer` · `jury` · `member` · `spectator`.
4. **Rol kapsamı:** global (tenant) veya sepet-bazlı (`scope_basket_id` — `jury` için).
5. **Sunucu tarafı zorlama:** her yazma route handler / server action üzerinden geçer ve izni
   kontrol eder. İstemci sadece UI gösterir/gizler — **kontrol istemcide değil**.
6. **Tenant admin ekranı:** rol oluştur/düzenle, kullanıcıya rol ata, izin matrisi.
7. `tenants.settings` yönetişim kadranı + varsayılanlar (hafif).
8. Migration: mevcut kullanıcılara `member`; sepet açanlara `organizer`.

**Çıkış kapısı**
- [ ] İzin matrisi testi **API seviyesinde**: `member` → `hackathon.create` = **403**;
      `organizer` = **200**. (UI'da buton gizli olması yeterli sayılmaz.)
- [ ] Sepet-bazlı `jury` rolü sadece o sepette geçerli.
- [ ] Tenant admin rol düzenleyip etkisini aynı oturumda görüyor.
- [ ] S0 + S1 testleri yeşil.

---

## S3 — RLS: izolasyon + realtime ✅ Duo kapısı

**Amaç:** RBAC'ı gerçek yapmak. **Bu sprint olmadan S2 dekordur.**
**Giriş koşulu:** S2 kapısı geçti.

**Kapsam**
1. **Tüm tablolarda RLS aç.** Politikalar `tenant_id` + rol/izin üzerinden.
2. Okuma: kullanıcı kendi tenant'ını görür; `vote.view_all` yoksa oy sahibi maskelenir;
   `hidden` içerik moderatör dışında görünmez.
3. Yazma: izin kataloğuyla hizalı.
4. **Realtime'ı RLS altında doğrula** — abonelikler de politikaya tabi; `useRealtimeVotes`
   davranışı (optimistic + reconnect + fallback polling) bozulmamalı.
5. Anon key ile erişilebilen yüzeyi daralt; gerekiyorsa hassas işleri service-role ile sunucuya taşı.

**Çıkış kapısı (güvenlik — en kritik kapı)**
- [ ] **Ham anon key testi:** A tenant'ının token'ıyla, uygulamayı atlayarak doğrudan Supabase'e
      sorgu — B tenant'ının **hiçbir** satırı okunamıyor/yazılamıyor.
- [ ] `member` rolüyle doğrudan `votes` sorgusu → başkasının oy sahibi bilgisi gelmiyor.
- [ ] Realtime akışı çalışıyor; oylama gecikmesi ölçülüyor.
- [ ] S0–S2 testleri yeşil.

**🚦 Duo kapısı:** Ajan durur, izolasyon testlerinin çıktısını raporlar, onay olmadan S4'e geçmez.

---

## S4 — Kavanoz (Fikir Deposu) + üç tab

**Amaç:** Ürünün omurgası. Fikirlerin kalıcı olarak biriktiği yer.
**Giriş koşulu:** S3 Duo onayı alındı.

**Kapsam**
1. `idea_pool`, `pool_votes` + realtime publication.
2. **Üç tab:** **Kavanoz · Hackathon · Etkinlik** — bu sırada (sıra ağırlığı yansıtır;
   Etkinlik sonuncu ve daha hafif). Geçiş kolay, bağlam kaybolmaz.
3. Kavanoz ekranı: fikir ekle (metin + brief + kategori), liste, kategori filtresi, arama,
   oy, durum rozeti. **Her an, her gün** fikir atılabilir.
4. **Poll:** kavanozda süreli oylama (`poll_closes_at`); **katılımcı yeni seçenek ekleyebilir**.
5. Durum makinesi: `yeni → oylanıyor → organize edildi → arşiv` (+ `reddedildi`).
6. **Dönüştür:** fikir(ler) → Hackathon (ana hat) veya Etkinlik (yan dal). `pool.promote` izni.
   `promoted_basket_id` bağlanır. Hackathon `ideaSource: 'repo'` seçeneği.
7. **Geri akış:** biten sepette kazanmayan fikirler → "Kavanoza at" (`source_basket_id`).
8. **Hızlı yol korunur:** doğrudan sepet açma davranışı **aynen** kalır.
9. Kavanoz oyu için mevcut realtime desenini yeniden kullan — yeni primitif yazma.
10. Tasarım: kavanoz aksanı önce `DESIGN-SYSTEM.md`'ye eklenir, sonra kullanılır.

**Çıkış kapısı**
- [ ] E2E: kavanozdan fikir seç → hackathon başlat → bitir → kavanozun o satırında
      "→ Hackathon'da kullanıldı, kazanan: X" görünüyor.
- [ ] E2E: kaybeden fikir "Kavanoza at" ile kavanoza düşüyor, kaynağı görünüyor.
- [ ] E2E: poll açılıyor, ikinci kullanıcı yeni seçenek ekliyor, oylanıyor.
- [ ] Hızlı yol regresyonu: kavanoza uğramadan sepet açılabiliyor (S0 smoke yeşil).
- [ ] `pool.promote` izni olmayan dönüştüremiyor (API seviyesinde).

---

## S5 — Sonuç / Arşiv ✅ Duo kapısı

**Amaç:** *"Bitince kim vardı, ne oldu, ne oy vardı — bunun tablosu."* Ve S8'in girdisi.
**Giriş koşulu:** S4 kapısı geçti.

**Kapsam**
1. Biten her sepet için kalıcı **sonuç sayfası**: katılımcılar, takımlar, fikirler, oy/skor
   kırılımı, kazanan, feedback, süre, tarih. **Her sepet tipi** için (hackathon + etkinlik).
2. **Arşiv listesi:** filtre (tip/tarih/kategori), arama. Kapsam `archive.view_all` iznine göre.
3. **CSV dışa aktarım.**

**Çıkış kapısı**
- [ ] E2E: hackathon'u uçtan uca bitir → sonuç tablosunda katılımcı, takım, oy, kazanan doğru.
- [ ] E2E: etkinliği bitir → sonuç tablosu doğru.
- [ ] Arşivden eski sepet açılıyor; CSV indiriliyor, içeriği doğru.
- [ ] `archive.view_all` izni olmayan sadece katıldığı sepetleri görüyor.
- [ ] Tenant izolasyonu arşivde de geçerli (S3 testi arşiv üstünde tekrar).

**🚦 Duo kapısı:** Doğal duruş noktası — ürün tutarlı. Devam/dur kararı.

---

## S6 — ★ İmza an: çekiliş + dağıtım

**Amaç:** Ürünün ruhunu yerine koymak. **Varlık hazır — taşınacak, yeniden yazılmayacak.**

**Neden:** `RaffleReveal.tsx` (191 satır: shuffle → yavaşlama → kilitlenme → reveal) **sadece
`SocialBasket`'te** kullanılıyor — yani "akşam nereye gidelim"de. Hackathon'daki fikir çekimi
`IdeaStage.tsx:51`'de çıplak `Math.random()`. `canvas-confetti` kurulu ama hiç kullanılmamış.
**En değerli çekiliş dramasız; en değersizi şölen.** Ters çevir.

**Giriş koşulu:** S5 Duo onayı alındı.

**Kapsam**
1. **Fikir çekimi:** `IdeaStage`'de `poolSelect: 'random'` → `RaffleReveal` + **confetti**.
   Çıplak `Math.random()` kaldırılır (kazanan önce seçilir, animasyon görseldir).
2. **Dağıtım çekimi:** takım↔fikir eşleşmesi de çekilişle sahnelenir.
3. **`ideaAssignment` modları:** `same` (fikri atan yapar) · **`cross`** (başkasının fikrini
   başkası yapar — kura ile çapraz) · `manual`.
4. **Birden fazla fikir** (`ideaCount`): N fikir takımlara dağıtılır. `1` = bugünkü davranış;
   tek fikirde takım kendi **açısını** beyan edebilir (`teams.angle`).
5. **Geçilebilir:** çekiliş her zaman istenmez → **atla** butonu + `prefers-reduced-motion`
   desteği (`revealAnimation` config'i; varsayılan `true`).
6. Skorboard (S7) ve sonuç sayfası (S5) birden fazla fikirle çalışır.

**Çıkış kapısı**
- [ ] E2E: kavanozdan fikir çekilirken shuffle → reveal → confetti akıyor.
- [ ] E2E: `cross` modunda kimin fikrinin kime düştüğü sahneleniyor ve doğru atanıyor.
- [ ] E2E: 3 takım 3 farklı fikir → sonuç sayfasında hangi takım hangi fikri yaptı doğru.
- [ ] **Atla** butonu tek tıkla geçiyor; `prefers-reduced-motion`'da animasyon çalışmıyor.
- [ ] `ideaCount: 1` + `same` eski davranışı bozmuyor (S0 smoke yeşil).

---

## S7 — Puanlama (rubrik + jüri) ✅ Duo kapısı

**Amaç:** Değerlendirmeyi tek oydan kategori+yıldız rubriğine taşımak.
**Giriş koşulu:** S6 kapısı geçti.

**Kapsam**
1. `scores` + realtime.
2. **Standart kategori kütüphanesi** (kodda sabit): `coding` · `ui` · `tech` · `usability` ·
   `impact` · `innovation` · `completeness` · `presentation` · `subjective`.
3. **Kurulum:** admin ~5 seçer (varsayılan hazır gelir) + `subjective` + **en fazla 2 özel**.
4. **Puanlama ekranı:** her takım × her kategori → 1–5 yıldız.
5. **Skorboard:** ağırlıklı toplam + **kategori kırılımı**, canlı.
6. **Jüri ağırlığı:** `juryEnabled` + `juryWeight`; `jury` rolü S2'den; `scores.is_jury`.
7. **Geriye uyum:** `scoringMode: 'simple'` mevcut tek-oy davranışını korur; varsayılan `simple`.

**Çıkış kapısı**
- [ ] E2E: rubrikli hackathon uçtan uca; skorboard kategori kırılımını doğru gösteriyor.
- [ ] Ağırlıklı skor hesabı birim testiyle doğrulanmış (jüri ağırlığı dahil).
- [ ] `scoringMode: 'simple'` eski akışı bozmuyor.
- [ ] **Basitlik testi:** rubrik kurulumu **3 tıkta** bitiyor (varsayılan seti kabul et → başlat).

**🚦 Duo kapısı:** Basitlik öznel — Duo ekranı görür, "karmaşıklaştı mı" kararını verir.

---

## D1 — ★ Production yayın

**Amaç:** Mevcut geliştirmelerin (hotfix + S4–S7) canlıda gerçekten çalışması. **Kod deploy
edilmeden hiçbir sprint "bitmiş" sayılmaz** — kullanıcı ürünü canlıda görmeli.

**Neden burada:** `main`'e kod gitti ama production Supabase şeması geride. Login "tanımsız
tenant" veriyor çünkü prod DB'de `duosis.com` domain kaydı ve S4–S7 tabloları yok. **En yüksek
öncelik:** önce canlıyı düzelt, sonra yeni kapsam.

**Kapsam**
1. `development` → `main` merge; Vercel production deploy (CI kapısından geçerek).
2. **Prod Supabase migration'ları** sırayla uygulanır (hepsi idempotent):
   `0006_idea_pool` → `0007_tenant_domains` → `0008_team_idea_assignment` → `0009_scores`.
3. `0007` ile DuoSis tenant'ına `duosis.com` domain'i bağlanır (gerçek iş e-postası).
4. Prod ortam değişkenleri doğrulanır: `NEXT_PUBLIC_SUPABASE_URL`, anon key, `AZURE` OAuth
   redirect (`redirectTo = origin`) prod domaininde çalışıyor.

**Çıkış kapısı**
- [ ] Vercel'de son `main` deploy'u yeşil.
- [ ] Prod DB'de `tenant_domains` içinde `duosis.com` var; `resolve_tenant_for_claims` çalışıyor.
- [ ] `https://fikir-sepeti-duosis.vercel.app/login` → Microsoft `@duosis.com` girişi başarılı;
      "tanımsız tenant" reddi kaybolmuş.
- [ ] Kavanoz / arşiv / hackathon (S4–S7) canlıda hatasız açılıyor.

---

## SG1 — Landing + giriş noktaları

**Amaç:** Ürünü **dışarıya** anlatan, sisteme yönlendiren bir kapı. Bugün oturumsuz kullanıcı
doğrudan login modal'ı görüyor; ürünün ne olduğunu anlatan bir yüz yok.

**Giriş koşulu:** D1 canlıda.

**Kapsam**
1. **Landing rotası:** oturumsuz `/` → landing (mevcut uygulama ana ekranı oturumlu kullanıcıya
   kalır). Hero + ürün anlatımı ("Fikirden prototipe") + imza an vurgusu.
2. **Katman kartları (yönlendirme, kesin fiyat yok):**
   - **Ücretsiz** — tüm ekipler için: kavanoz, hackathon, etkinlik, oylama, çekiliş.
   - **Analitik** — huni, katılım trendi, üretim metriği (S8 ile açılır; burada teaser CTA).
   - **Entegrasyon** — "her mesleğe göre" (Hermes/araç köprüleri) — "İletişime geç" CTA.
3. **Sağ üst navigasyon:** Giriş · Kayıt (oturumsuz), oturumluysa "Uygulamaya git".
4. **CTA yönlendirme:** her katman kartı ve hero → `/login` veya `/register` (SG2).
5. Tasarım **`DESIGN-SYSTEM.md`** token'larıyla; yeni renk gerekmiyor (clay + altın aksan).

**Çıkış kapısı**
- [ ] E2E: oturumsuz `/` landing render ediyor; katman kartları + Giriş/Kayıt görünüyor.
- [ ] E2E: oturumlu kullanıcı `/` → uygulama ana ekranını görüyor (landing değil).
- [ ] Giriş ve Kayıt butonları doğru rotalara yönlendiriyor.
- [ ] Regresyon: mevcut S0–S7 testleri yeşil.

---

## SG2 — Kayıt + self-serve tenant

**Amaç:** Elle SQL yerine **arayüzden** kayıt ve çalışma alanı açma. Kurumsal **ve** bireysel
kullanıcı desteklenir; kayıt akışı **girişin türüne göre yönlenir.**

**Giriş koşulu:** SG1 tamam.

**Kapsam**
1. **Kayıt rotası `/register`:** Supabase e-posta+şifre (e-posta doğrulama) + mevcut Azure OAuth.
2. **Girişe göre yönlendirme (kayıttan sonra tenant çözümlemesi):**
   - **Domain eşleşiyor** (`tenant_domains`) → otomatik o tenant'a `member` olarak katıl.
   - **Azure kurumsal tenant** eşleşiyor → aynı şekilde katıl.
   - **Eşleşme yok** (Gmail/Hotmail dahil bireysel) → iki seçenek:
     **(a) Çalışma alanı oluştur** (tenant adı + **opsiyonel** domain; kurucu `tenant_admin`),
     **(b) Davet koduyla katıl.**
3. **Self-serve tenant oluşturma:** `create_tenant_for_user` RPC — tenant satırı + kurucu
   `app_users` + `tenant_admin` rolü; domain verildiyse `tenant_domains`'e ekle (domain **zorunlu
   değil**). `tenants.plan = 'free'`, `tenants.status = 'active'`.
4. **Davet:** tenant_admin davet kodu/linki üretir; kod domain'siz kullanıcıyı tenant'a bağlar.
5. `resolve_tenant_for_claims` korunur; domain'siz kullanıcı için tenant üyeliği `app_users` +
   `user_roles` üzerinden (domain kaydı olmadan) çözülür.

**Çıkış kapısı**
- [ ] E2E: bilinmeyen domainli e-posta ile kayıt → "çalışma alanı oluştur" → yeni tenant + kurucu
      `tenant_admin`; kullanıcı kendi tenant'ında sepet açabiliyor.
- [ ] E2E: bilinen domainli e-posta ile kayıt → otomatik mevcut tenant'a katılıyor.
- [ ] E2E: davet koduyla domain'siz kullanıcı mevcut tenant'a katılıyor.
- [ ] Tenant izolasyonu korunuyor: yeni tenant başka tenant'ın satırlarını göremiyor (S3 tekrar).
- [ ] Birim: tenant çözümleme (domain / azure / bireysel) doğru yönlendiriyor.

---

## SG3 — Platform yönetim paneli

**Amaç:** SaaS omurgası. `platform_owner` tüm tenant'ları görür ve yönetir; hiyerarşi
**platform → tenant → kullanıcı** netleşir.

**Giriş koşulu:** SG2 tamam.

**Kapsam**
1. **`/admin` rotası** (`platform_owner` izni; API seviyesinde zorlanır):
   - Tenant listesi: ad, domain(ler), kullanıcı sayısı, plan, durum, oluşturma tarihi.
   - Plan yönetimi: `tenants.plan` (`free` | `analytics`) düzenle.
   - **Askıya alma:** `tenants.status` (`active` | `suspended`); askıdaki tenant girişte reddedilir.
   - Tenant detayında kullanıcı + rol görünümü (salt-görüntü + `platform_owner` müdahalesi).
2. **Tenant kendi kendini yönetir:** mevcut `/tenant/roles` (tenant_admin) korunur; rol atama,
   izin matrisi, yönetişim kadranı.
3. **Hiyerarşi izinleri:** `platform.manage_tenants` izni (yeni) yalnızca `platform_owner`'da.
4. RLS: `platform_owner` cross-tenant okuma; diğer roller yalnızca kendi tenant'ı (S3 politikası
   üstüne `platform_owner` istisnası).

**Çıkış kapısı**
- [ ] E2E: `platform_owner` `/admin`'de tüm tenant'ları görüyor; `tenant_admin` göremiyor (API 403).
- [ ] E2E: tenant plan/durum değiştirilebiliyor; `suspended` tenant kullanıcısı girişte reddediliyor.
- [ ] Tenant izolasyonu bozulmuyor: `tenant_admin` yalnızca kendi tenant'ını yönetiyor.
- [ ] Birim: `platform.manage_tenants` izin kontrolü.

---

## S8 — ★ Analitik huni ✅ Duo kapısı

**Amaç:** İki iş birden — **paralı katmanın ürünü** ve **kapının vitrini.**
**Giriş koşulu:** SG serisi tamam (D1 + SG1–SG3); S7 kapısı geçti.

**Kapsam**
1. **Huni ekranı:** `fikir girildi → oylandı/seçildi → organizasyona dönüştü → yapıldı →
   ÜRETİME ALINDI`. Her aşamada sayı + dönüşüm oranı.
2. **Üretime alınanlar listesi:** ne yapıldı, kim yaptı, **tahmini efor**
   (`baskets.production_note`, `effort_estimate`). ← Hermes köprüsünün yeri; entegrasyon
   yokken bile kapı gösterilebiliyor.
3. **Katılım trendi:** aylık aktif katılımcı + **3. ay sürdürülen katılım metriği** öne çıkar.
   (Kategorinin battığı yer; tek başarı ölçütümüz.)
4. **Teaser:** ücretsiz katmanda özet ("Son 3 etkinlikte katılım %64"), detay `analytics.view`
   ister. **Duvar değil, iştah.**
5. Veri kaynağı S5 arşivi — yeni yazma yolu icat etme.

**Çıkış kapısı**
- [ ] E2E: seed'li tenant'ta huni her aşamayı doğru sayıyor; dönüşüm oranları doğru.
- [ ] Üretime alınanlar listesi dolu; efor girilebiliyor ve toplanıyor.
- [ ] 3. ay katılım metriği birim testiyle doğrulanmış (zaman pencereli hesap).
- [ ] Ücretsiz katmanda teaser görünüyor; detay `analytics.view` olmadan **API seviyesinde** reddediliyor.
- [ ] Tenant izolasyonu analitikte de geçerli.

**🚦 Duo kapısı — "kapı" kapısı:** Ürün burada gösterilebilir olmalı. Duo ekranı görür ve tek
soruyu sorar: *"Bunu bir müşteriye açsam, bize ne kazandıracağı ekranda görünüyor mu?"*

---

## S9 — Moderasyon + denetim

**Kapsam**
1. `content_rules`, `content_flags`, `audit_log`.
2. **Kural yönetimi:** tenant admin kelime/desen listesi; kural başına `uyar` (varsayılan) / `engelle`.
3. **Uyarı akışı:** *"Metninde şu kelimeler geçiyor. Göndermek istediğine emin misin?"*
4. **Moderatör kuyruğu:** bayraklı içerik → onayla / gizle (`hidden`). `content.moderate` izni.
5. **Denetim kaydı:** moderasyon + rol değişiklikleri + dönüştürme → `audit_log`.
6. **Oy görünürlüğü UI'ı:** `vote.view_all` olan görür, olmayan görmez. (Politika S3'te.)
7. Kurallar `idea_pool`, `ideas`, `feedback` girişlerine uygulanır.

**Çıkış kapısı**
- [ ] E2E: yasaklı kelimeli fikir → uyarı; onaylayınca geçiyor, bayrak düşüyor.
- [ ] E2E: `engelle` kuralı → gönderilemiyor.
- [ ] Moderatör gizlediğinde içerik sıradan üyeye görünmüyor (**API seviyesinde de**).
- [ ] `vote.view_all` olmayan kimin ne oyladığını göremiyor.
- [ ] `audit_log` moderasyon + rol değişikliğini kaydediyor.
- [ ] **Varsayılan hafif:** yeni tenant'ta moderasyon `warn`, engelleme kapalı.

---

## S10 — Proje bazlı feedback

**Kapsam**
1. `feedback.team_id` / `idea_id` **zaten var** — UI'ya bağla.
2. Puan/oy verirken o projeye özel yorum.
3. Takım kendi feedback'ini toplu görür.
4. Sonuç sayfasında (S5) proje başına feedback listesi.
5. Moderasyon kuralları (S9) feedback'e de uygulanır.

**Çıkış kapısı**
- [ ] E2E: takıma yorum → takım detayında ve sonuç sayfasında doğru yerde görünüyor.
- [ ] Yorumlar takım takım gruplanmış; düz liste yok.

---

## S11 — Lobi kontrolü + davet

**Kapsam**
1. `lobbyPolicy: 'open' | 'approval'`; approval'da admin onaylar (`participants.approved`).
2. **Kilit:** `phase != lobby` → yeni katılım kapalı; `allowLateJoin` istisnası (`lobby_locked`).
3. **Fikir belli / belli değil:** lobide `static` ise katılımcı fikri görür; `pool`/`repo` ise
   "fikir birlikte belirlenecek". (Bugün katılımcı sadece "bekle" görüyor.)
4. **Pop-up isim görünümü:** avatara dokun → isim/e-posta popover.
5. **Davet:** WhatsApp linki + QR — **zenginleştirme değil, viral mekanik.** Altyapı
   `InvitePanel.tsx`'te hazır; **Etkinlik'e de bağlanır.**

**Çıkış kapısı**
- [ ] E2E: approval modunda onaylanmayan lobiye giremiyor.
- [ ] E2E: başlamış hackathon'a link'le girilemiyor; `allowLateJoin` açıkken girilebiliyor.
- [ ] Katılımcı lobide fikrin durumunu görüyor. Avatar popover ismi gösteriyor.
- [ ] Etkinlik'ten WhatsApp linki ve QR üretilebiliyor.

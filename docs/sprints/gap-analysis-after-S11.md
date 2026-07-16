# Gap analysis — after S8–S11 (2026-07-16)

Post-sprint inventory of known gaps, risks, and follow-ups. Not a new sprint plan.

## Duo kapıları (ürün)

| Kapı | Durum | Not |
|---|---|---|
| S7 basitlik | ⏸️ bekliyor | Kod geçti; Duo onayı yok |
| S8 "müşteriye açsam…" | ⏸️ bekliyor | `/analytics` canlı kodda; ürün incelemesi yok |

## Teknik / ürün eksikleri

0. **🔴 Prod API / sayfa işlemleri hâlâ kırık (kullanıcı 2026-07-16)** — Hard refresh sonrası da aynı.
   - İlk teşhis: client JWT yok → `fix/prod-api-bearer-auth` deploy edildi (CI+Vercel ✅).
   - **Kullanıcı doğrulaması: sorun devam ediyor** — Bearer fix tek başına yetmedi veya başka katman var.
   - Sonraki debug (şimdilik ertelendi): Network’te `/api/*` status (401/403/500), `Authorization` header var mı, Vercel/Supabase env, `app_users` eşleşmesi, Azure session.
   - Rapor: `docs/sprints/hotfix-prod-api-bearer-report.md`

1. **Analitik teaser metriği zayıf** — son N etkinlikte `capacityHint ≈ participantCount` olduğu için yüzde çoğu zaman ~100. Gerçek kapasite (tenant üye sayısı) bağlanmalı.
2. **3. ay retention** — seed/tek seferlik oylarda ay penceresi boş kalabilir; demo için zaman kaydırmalı seed faydalı.
3. **Hermes köprüsü** — `effort_estimate` alan var, entegrasyon yok (bilinçli).
4. **`tenants.settings.moderation`** — plan kadranı UI’da yok; kurallar sayfası var, tenant-level varsayılan profil yok.
5. **S9 gizli içerik** — archive/API filtreliyor + RLS; realtime client kanalı hâlâ hidden satır event’i görebilir (UI refresh sonrası kaybolur).
6. **platform_owner kapsamı** — prod’da tüm `@duosis.com` kullanıcılarına verilmişti; daraltılmalı (sadece gerçek platform admin).
7. **Local Docker yok** — ajan ortamında E2E koşulamadı; doğrulama CI’ya bağlı.
8. **Register / Azure e-posta onayı** — prod auth akışı manuel doğrulanmalı (SG2 sonrası).
9. **S11 seed hackathon** — testler seed sepeti `lobby` + approval’a çekiyor; smoke-hackathon ile çakışma riski (sıra/CI workers=1 ile hafifler).
10. **InvitePanel SocialBasket** — her etkinlikte owner’a görünür; mobilde kalabalık olabilir.

## Sprint tablosu (özet)

S0–S11 + D1 + SG1–SG3 kod tarafında ✅. Kalan: Duo kapıları (S7/S8) + yukarıdaki polish.

## Önerilen sonraki adımlar

1. ~~Prod API Bearer fix deploy~~ → kullanıcıya doğrulat (`/admin`, `/analytics`, `/moderation`, sepet oluştur).
2. Duo: S7 basitlik + S8 vitrin ekranı.
3. Teaser metriğini tenant üye sayısına bağla.
4. `platform_owner` daraltma.
5. İsteğe bağlı: Hermes, tenant settings kadranı, retention demo seed.

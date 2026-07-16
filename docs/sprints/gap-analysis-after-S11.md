# Gap analysis — after sepet rename + env sync (2026-07-16)

## Yapılanlar
- Prod API: Bearer + `getDb` JWT/RLS fallback (önceki deploy).
- Ürün dili: **Kavanoz → Sepet** (UI, landing, design tokens metni, E2E).
- GitHub workflow: `Sync Vercel production env` — AUTH_BYPASS kaldır + isteğe bağlı SERVICE_ROLE.

## Benim yapamadığım (senden)
1. **Production `SUPABASE_SERVICE_ROLE_KEY`** — yereldeki key yalnızca `127.0.0.1` Docker; prod key yok.
   - Supabase Dashboard → Project Settings → API → `service_role`
   - Sonra: `gh secret set SUPABASE_SERVICE_ROLE_KEY` (değeri yapıştır)
   - Ardından Actions → **Sync Vercel production env** çalıştır
2. Vercel CLI login bu ortamda yoktu; env sync Actions üzerinden.

## Not
`idea_pool` prod’da 0 satır — Sepet sekmesi boş görünebilir (seed/manual fikir gerekir).

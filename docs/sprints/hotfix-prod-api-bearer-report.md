# Hotfix — Prod API Bearer auth

**Tarih:** 2026-07-16  
**Branch:** `fix/prod-api-bearer-auth`  
**Tetik:** Kullanıcı — sayfalar var ama işlevsiz / işlemde hata.

## Kök neden

Browser → `/api/*` çağrıları yalnızca `NEXT_PUBLIC_AUTH_BYPASS=1` iken `X-Dev-User` ekliyordu.
Production’da bypass kapalı → `resolveIdentity` Bearer bulamıyor → **401**. UI render olur, veri/aksiyon kırılır.

## Düzeltme

- `lib/api-headers.ts` — bypass’ta Dev-User; aksi halde Supabase `access_token` → `Authorization: Bearer`
- Güncellenen client’lar: archive, analytics, moderation, pool, baskets, lobby, admin, roles, result CSV

## Doğrulama

- CI (bypass) hâlâ X-Dev-User ile geçer ✅
- Prod deploy ✅
- **Kullanıcı (2026-07-16):** hard refresh sonrası sorun **devam ediyor** — fix yetersiz veya ayrı kök neden.
  Ertelenen debug: DevTools Network (`/api/*` status + `Authorization`), env, `app_users` / Azure session.

## Durum

⏸️ Açık — not alındı; ürün geliştirmelerine devam (debug sonraya).

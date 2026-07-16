# S9 — Moderasyon + denetim

**Durum:** ✅ geçti
**Tarih:** 2026-07-16
**Branch:** `sprint/S9-moderasyon`

## Kapsam

1. Migration `0014_moderation.sql` — `content_rules`, `content_flags`, `audit_log`, `ideas.hidden`, `feedback.hidden`
2. Pure `lib/moderation.ts` + server helpers
3. Rules CRUD + flags queue API; `/moderation` UI
4. Moderated create: `/api/content/ideas`, `/api/content/feedback`, pool POST
5. Warn (409) / block (422) + acknowledge; hide → API/RLS gizler
6. Archive votes masked without `vote.view_all`
7. Role assign/revoke → `audit_log`

## Test

- `tests/unit/moderation.spec.ts`
- `tests/s9-moderation.spec.ts`

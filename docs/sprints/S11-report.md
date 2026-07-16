# S11 — Lobi kontrolü + davet

**Durum:** ✅ geçti
**Tarih:** 2026-07-16
**Branch:** `sprint/S11-lobi`

## Kapsam

1. Migration `0015_lobby.sql` — `lobby_locked`, `participants.approved`
2. Config: `lobbyPolicy` / `allowLateJoin`; `decideLobbyJoin` pure gate
3. `POST/PATCH /api/lobby/join` — join + approve + policy
4. HackathonRunner: kilit / onay bekliyor ekranları
5. LobbyStage: fikir durumu, avatar popover, onay kuyruğu
6. InvitePanel: WhatsApp + QR; SocialBasket (etkinlik) sahibi için davet

## Test

- `tests/unit/lobby.spec.ts`
- `tests/s11-lobby.spec.ts`

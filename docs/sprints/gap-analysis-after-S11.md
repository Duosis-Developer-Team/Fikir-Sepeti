# Gap analysis — after complete-dev-before-qa (2026-07-16)

## Prod API kök neden (düzeltildi)

1. Vercel Production’da `NEXT_PUBLIC_AUTH_BYPASS=1` vardı.
2. `apiAuthHeaders` bypass’ta **erken return** edip yalnızca `X-Dev-User` gönderiyordu → Bearer yok.
3. `SUPABASE_SERVICE_ROLE_KEY` Production’da **yoktu** → `supabaseAdmin()` API route’larda patlıyordu.

### Fix
- `apiAuthHeaders`: bypass + session Bearer birlikte.
- `resolveIdentity`: Bearer öncelikli.
- `getDb(req)`: service role yoksa JWT+anon (RLS).
- `/api/me`, `/api/permissions`, `/api/scores`; DemoStage skorları API üzerinden; analytics teaser kapasitesi = tenant üye sayısı.

## Hâlâ önerilen ops (manuel)

1. Production’dan `NEXT_PUBLIC_AUTH_BYPASS` kaldır (güvenlik).
2. `SUPABASE_SERVICE_ROLE_KEY` ekle (CI/bypass ve admin edge-case’ler için).
3. Duo kapıları S7/S8 ürün onayı.
4. `platform_owner` daraltma (@duosis.com hepsi değil).

## Sprint kod durumu

S0–S11 + D1 + SG1–SG3 kod ✅. Deploy sonrası manuel QA listesi chat’te.

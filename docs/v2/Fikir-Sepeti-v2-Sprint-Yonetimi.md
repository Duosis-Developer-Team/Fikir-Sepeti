# Fikir Sepeti — v2 Sprint Yönetimi (Runbook)

**Tarih:** 14 Temmuz 2026 · **Revizyon:** 2 (kimlik + odak revizyonu)
**Bu doküman kime:** Sprintleri uygulayacak AI ajanına. **Önce bunu oku, sonra çalışmaya başla.**

> **Ürünün kimliği — her kararın süzgeci:**
> Tagline **"Fikirden prototipe."** · Tek cümle: *Fikir Sepeti, çalışan fikirlerini üretim
> kararına hazır prototiplere dönüştüren platformdur.* · Sınır: **üretim kapısına kadar.**
> Amaç: verimliliği **eğlenceli biçimde** artırmak — eğlence benimseme mekanizmasıdır.
> Bir özellik bu cümleye hizmet etmiyorsa, kapsamı sorgula.

**Okuma sırası:**
1. `Fikir-Sepeti-v2-Proje-Plani.md` — ne yapılacak, neden, veri modeli
2. `Fikir-Sepeti-v2-Sprint-Plani.md` — sprint sprint kapsam ve çıkış kapıları
3. **Bu doküman** — nasıl ilerlenecek, ne zaman durulacak
4. Kod deposunda: `CLAUDE.md`, `AGENTS.md`, `DESIGN-SYSTEM.md`

---

## 1. Temel kural

> **Kapı geçilmeden sonraki sprint başlamaz.**

Zaman baskısı yok. Tek ölçüt: **kapı yeşil mi.** Yeşilse duraksamadan devam et; değilse dur ve
düzelt. "Sonra bakarız" diye ilerlemek yok — S1–S3 altyapı; üstüne yarım temelle bina çıkarsa
sonraki her sprint o borcu öder.

---

## 2. Sprint döngüsü

Her sprint için aynı altı adım:

```
1. OKU      → Sprint planındaki kapsamı ve çıkış kapısını oku. Belirsizlik varsa §6'ya bak.
2. BRANŞ    → git checkout -b sprint/SX-kisa-ad   (main'e doğrudan commit YOK)
3. YAZ      → Kapsamdaki maddeleri sırayla uygula. Her anlamlı adım ayrı commit.
4. TEST     → Kapıdaki her maddeyi otomatik teste çevir. Test yoksa madde tamam sayılmaz.
5. KAPI     → npm run lint && npm run build && npx playwright test  → hepsi yeşil mi?
              + Regresyon: önceki sprintlerin testleri de yeşil mi?
6. RAPOR    → §4'teki formatta rapor yaz. Duo kapısıysa DUR. Değilse merge → sonraki sprint.
```

---

## 3. Kapı protokolü

**Kapı = otomatik test.** Sprint planındaki her `[ ]` maddesi bir teste karşılık gelir.
"Elle baktım, çalışıyor" kapı değildir.

**Üç test seviyesi — hangisi ne zaman:**

| Seviye | Ne için | Örnek |
|---|---|---|
| **Birim** | Saf mantık | Ağırlıklı skor hesabı (S7), tenant çözümleme (S1) |
| **API** | İzin/güvenlik | `member` → `hackathon.create` = 403 (S2) |
| **E2E (Playwright)** | Kullanıcı akışı | Depodan fikir → hackathon → sonuç (S4) |

**Güvenlik kapıları API seviyesinde doğrulanır — UI testi yetmez.** "Buton gizli" güvenlik
değildir; kullanıcı isteği doğrudan atabilir. S2, S3, S6, S12'de bu kural mutlak.

**Regresyon kuralı:** Test paketi **kümülatif**. S7'deyken S0'ın smoke testi de yeşil olmalı.
Eski test kırıldıysa: ya kod bozuldu (düzelt) ya davranış bilerek değişti (**testi güncelle ve
raporda gerekçesini yaz**). Testi sessizce silme veya `skip` etme — bu, kapıyı kandırmaktır.

---

## 4. Rapor formatı

Her sprint sonunda:

```markdown
## SX — <ad> · <GEÇTİ | KALDI>

**Yapıldı:** <kapsam maddeleri, kısa>
**Kapı sonucu:**
  - lint: ✅ / build: ✅ / test: 34 geçti, 0 kaldı
  - Kapı maddeleri: <her [ ] için ✅/❌ + hangi test dosyası kanıtlıyor>
**Regresyon:** önceki sprint testleri ✅
**Sapmalar:** <plandan ayrıldığın yer + gerekçe. Yoksa "yok".>
**Duo'ya soru:** <varsa. Yoksa "yok".>
**Sonraki:** S(X+1) — <ad>
```

Sapma varsa **mutlaka yaz.** Plandan sessizce ayrılmak, sonraki sprintin varsayımını bozar.

---

## 5. Duruş noktaları

Ajan **dört yerde** durur ve Duo onayı bekler:

| Kapı | Nerede | Neden | Ne raporlanır |
|---|---|---|---|
| 🚦 **Güvenlik** | S3 sonrası | Tenant izolasyonu kritik; yanlışsa geri dönüşü pahalı | Ham anon key izolasyon testinin çıktısı |
| 🚦 **Omurga** | S5 sonrası | Doğal duruş noktası — ürün tutarlı. Devam/dur kararı | Çalışan akışın ekran görüntüleri/özeti |
| 🚦 **Basitlik** | S7 sonrası | "Karmaşıklaştı mı" öznel; insan kararı | Rubrik kurulum ekranı + kaç tık |
| 🚦 **Kapı** | S8 sonrası | v2'nin asıl sınavı | Analitik huni ekranı. Tek soru: *"Bunu bir müşteriye açsam, bize ne kazandıracağı ekranda görünüyor mu?"* |

Bunlar dışında **durma** — kapı yeşilse ilerle.

**Ek olarak şu üç durumda her zaman dur:**
1. **Kapı iki kez üst üste kırmızı** ve nedeni anlaşılmıyorsa.
2. **Plan gerçekle çelişiyorsa** (ör. veri modeli kodda karşılık bulmuyor). Uydurma — sor.
3. **Kapsam dışına çıkman gerekiyorsa** (proje planı §6'daki bir şeye dokunmak zorundaysan).

---

## 6. Karar hiyerarşisi

Belirsizlikte şu sırayla bak:

1. **Sprint planı** — kapsam ve kapı orada.
2. **Proje planı** — mimari kararlar, veri modeli, "ajan için notlar" (§8).
3. **Kod deposu** — `CLAUDE.md`, `DESIGN-SYSTEM.md`, mevcut desenler. **Mevcut desen kazanır.**
4. **Hiçbiri cevap vermiyorsa** — Duo'ya sor. **Tahmin etme.**

Proje planı §9'da **açık kararlar** var (kategori kütüphanesi, tenant tanımı). Bunlara denk
gelirsen dur ve sor; varsayılanı kendin seçme.

---

## 7. Değişmez kurallar

Bunlar her sprintte geçerli — ihlal edilirse kapı kırmızıdır:

1. **RBAC'ı RLS olmadan sevk etme** (S2 → S3 birlikte anlamlı). İzin kontrolü **sunucuda**.
2. **Mimariyi bozma:** hackathon modül sözleşmesi (`contract.ts` → `StageDef`). Yeni aşama =
   registry'ye satır. `if config.x else` dallanması **yasak** — config modül *seçer*.
3. **Realtime primitifini yeniden yazma:** `lib/useRealtimeVotes.ts` optimistic + reconnect +
   fallback polling'i çözmüş. Kavanoz oyu ve skorlar **aynı deseni** kullanır.
3b. **İmza anı yeniden yazma:** `RaffleReveal.tsx` çalışıyor, sadece yanlış yere bağlı (S6).
   **Taşı** — kopyalama, yeniden icat etme.
3c. **Etkinlik'e dokunma:** yan dal; bugünkü hali korunuyor. Zenginleştirme kapsam dışı
   (davet/QR hariç — S11).
4. **Geriye uyum:** mevcut sepetler bozulmaz. Config alanları opsiyonel; yoksa varsayılan
   (`scoringMode='simple'`, `lobbyPolicy='open'`, …).
5. **Migration idempotent** (`create table if not exists`, `do $$ … exception` deseni).
   İki kez çalışınca bozulmaz. **Veri kaybı sıfır.**
6. **Tasarım:** `DESIGN-SYSTEM.md` zorunlu. Yeni renk gerekiyorsa **önce** oraya ekle.
7. **Yönetişim varsayılanı hafif:** moderasyon `warn`, engelleme kapalı, oy görünürlüğü
   moderatörde. Kurumsal tenant kısar — ürün varsayılanda eğlenceli kalır.
8. **Hızlı yol korunur:** depoya uğramadan sepet açılabilmeli. Bu bir regresyon testidir.
9. **`main`'e doğrudan commit yok.** Sprint branşı → kapı → merge.

---

## 8. Sprint durum tablosu

Ajan her sprint sonunda bu tabloyu günceller ve commit eder.

| # | Sprint | Durum | Kapı | Not |
|---|---|---|---|---|
| S0 | Test zemini + CI kapısı | ✅ geçti | — | Playwright smoke + CI→deploy kapısı |
| S1 | Tenant modeli + veri taşıma | ✅ geçti | — | düz tenant; app-layer filtre |
| S2 | RBAC: rol, izin, zorlama | ✅ geçti | — | API /api/baskets + /tenant/roles |
| S3 | RLS: izolasyon + realtime | ✅ geçti | 🚦 Duo onaylandı | 2026-07-15 güvenlik kapısı |
| S4 | Kavanoz (Fikir Deposu) + üç tab | ✅ geçti | — | docs/sprints/S4-report.md |
| S5 | Sonuç / Arşiv | ✅ geçti | 🚦 Duo omurga | docs/sprints/S5-report.md — omurga + login hotfix sonrası S6 |
| Hotfix | Tenant login + /login | ✅ geçti | ⏸️ prod migrate | docs/sprints/hotfix-tenant-login-report.md — `duosis.com` + `/login` |
| S6 | ★ İmza an: çekiliş + dağıtım | ✅ geçti | — | docs/sprints/S6-report.md |
| S7 | Puanlama (rubrik + jüri) | ⏸️ Duo bekliyor | 🚦 Duo basitlik | docs/sprints/S7-report.md — kod geçti, basitlik kapısı bekliyor |
| D1 | ★ Production yayın | ✅ geçti | — | docs/sprints/D1-report.md — MCP 0002–0009; duosis.com resolve ✅ |
| SG1 | Landing + giriş noktaları | ✅ geçti | — | docs/sprints/SG1-report.md — oturumsuz `/` landing; /register stub |
| SG2 | Kayıt + self-serve tenant | ✅ geçti | — | docs/sprints/SG2-report.md — 0010 + /register + davet |
| SG3 | Platform yönetim paneli | ✅ geçti | — | docs/sprints/SG3-report.md — /admin + platform.manage_tenants |
| S8 | ★ Analitik huni | ✅ geçti | 🚦 Duo | docs/sprints/S8-report.md — teaser + full gate; ürün kapısı ayrı |
| S9 | Moderasyon + denetim | ✅ geçti | — | docs/sprints/S9-report.md — warn/block + kuyruk + audit |
| S10 | Proje bazlı feedback | ⬜ bekliyor | — | |
| S11 | Lobi kontrolü + davet | ⬜ bekliyor | — | |

**Durum kodları:** ⬜ bekliyor · 🟡 devam · ✅ geçti · 🔴 kapı kırmızı · ⏸️ Duo bekliyor

---

## 9. Bu plan değişebilir

Pazar analizi (ayrı doküman) sonrası **plan yeniden gözden geçirilecek** — satılabilirlik
bulguları kapsamı değiştirebilir. Ajan bu dokümanın **en güncel** halini okumakla yükümlü;
sprint başlarken tarihini kontrol et.

Bugün kesin olan: **S0–S5 sırası** (test zemini → tenant → RBAC → RLS → depo → arşiv).
Bu beşi pazar analizinden bağımsız — hangi pazara oynarsak oynayalım temel bu.

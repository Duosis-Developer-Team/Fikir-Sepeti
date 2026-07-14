# Fikir Sepeti — Tasarım Sistemi

> Tek kaynak. Her ekran bu dosyaya uyar. Yeni bir şey eklerken önce buraya bak.
> Kod karşılığı: `app/globals.css` (token'lar) + `app/layout.tsx` (fontlar).

---

## 1. Felsefe

Claude / Anthropic dilinden ilham: **sıcak-nötr, sakin, editorial, tek hero-aksanlı restraint.**

- **Koyu mod**, nötr-sıcak gri zemin (soğuk mavi-gri DEĞİL, cıvık sıcak turuncu-gri de DEĞİL).
- **Dev tipografi** hero'da; gerisi sessiz ve disiplinli.
- **Bir aksan öne çıkar** (clay), ikincil (altın) sadece build modunda. Panayır yok.
- **Yoğunluk** = canlı veri (bar + avatar + sayı). Boş beyaz ekran yok, ama gürültü de yok.
- Motion "wow" anlarına saklanır (kura reveal, presenter, canlı bar), gerisi hafif.

---

## 2. Renk

> **Kanonik kaynak:** `Design system documentation/` (onaylı Claude design konsepti). Kod: `app/globals.css` + `lib/accent.ts`.

### Zemin katmanları (nötr koyu — sıcak/soğuk değil)
| Token | Hex | Kullanım |
|---|---|---|
| `--black` | `#161616` | **Canlı / sahne / sonuç / featured** — en dramatik spotlight katman |
| `--bg` | `#1E1E1E` | Sayfa zemini (nötr koyu gri) |
| `--card` | `#272727` | Kartlar |
| `--surface-2` | `#2E2E2E` | Input / elevated |
| header bg | `rgba(30,30,30,0.82)` + blur | Sticky üst bar |

### Metin
| Token | Hex |
|---|---|
| `--text` | `#EDEDED` (ana) · `--text-2` `#C4C4C4` · `--text-3` `#B0B0B0` |
| `--text-muted` | `#9A9A9A` · `--text-faint` `#6E6E6E` |
| `--line` | `rgba(255,255,255,0.09)` · bar track `rgba(255,255,255,0.07)` |

### Aksanlar — 4 renk sepet + kavanoz (`lib/accent.ts`)
| Token | Hex | Atama |
|---|---|---|
| `--coral` | `#F2795F` (light `#F5A98F`) | sosyal / etkinlik (id hash) |
| `--gold` | `#E7A93F` (light `#EEC078`) | **hackathon** (sabit) |
| `--green` | `#33C293` (light `#6FD9B4`) | sosyal (id hash) |
| `--blue` | `#6B8CF0` (light `#8FA8F5`) | sosyal (id hash) |
| `--clay` | `#D97757` (light `#E4A08A`) | **Kavanoz** (fikir deposu) — sabit |

- `accentFor(basket)`: hackathon → gold; etkinlik → id hash ile coral/green/blue.
- `ACCENTS.clay` / `--clay`: üç tab Kavanoz yüzeyi, durum rozetleri, pool oy barları.
- Bir sepetin rengi kartında + detayında + barlarında + pill'lerinde tutarlı kullanılır.
- Dolgu: `rgba(<accent>,0.20)` lider / `0.09` diğer (oy satırı); kartta lider = düz base.
- Aksan üstü metin/pill: `#161616` (koyu). Açık pill butonlar: `#EDEDED` zemin / `#161616` metin.

### KESİN kurallar
- ✅ Nötr koyu `#1E1E1E` zemin. ❌ Soğuk mavi-gri, ❌ sıcak turuncu-gri zemin.
- ✅ 4 aksanlı çok-renk (coral/gold/green/blue) + clay kavanoz. ❌ Mor.
- Wordmark = 3 bar (coral/gold/green). Avatarlar = 4 aksandan hash ile, koyu harf.

---

## 3. Tipografi

| Rol | Font | Yükleme |
|---|---|---|
| Display (başlık, sayı, hero) | **Bricolage Grotesque** (`--font-display`, 500–800) | `next/font/google`, `app/layout.tsx` |
| Gövde / UI | **Plus Jakarta Sans** (`--font-body`, 400–700) | aynı |

- `.font-display` sınıfı: `letter-spacing: -0.02em`.
- Sayılar: `.tnum` (tabular-nums) — bar sayaçları, istatistik hizalı.

### Ölçek (kutsal — karışık boyut kullanma)
| Kullanım | Sınıf |
|---|---|
| Hero (ana ekran) | `text-[8.5vw] md:text-[4rem]` · **tek satır, "Bugün" + dönen kelime yan yana** |
| Sayfa başlığı (detay) | `text-4xl md:text-5xl` |
| Öne çıkan kart / presenter başlık | `text-4xl md:text-5xl` / presenter `text-7xl` |
| Kart başlığı | `text-2xl` (özet), `text-lg` (satır) |
| Eyebrow / label | `text-xs uppercase tracking-[0.18em–0.28em]` |
| Gövde | `text-sm` / `text-base` |

> **Hero kuralı:** "Bugün" ve dönen kelime **YAN YANA, tek satır** (alt alta değil). Dönen kelime `inline-grid` ile üst üste yığılı → reflow yok, dikey kayar. Bkz. `app/page.tsx` `RotatingQuestion`.

---

## 4. Boşluk & Layout

- İçerik genişliği: `max-w-6xl` (ana ekran), `max-w-3xl` (detay).
- Yatay padding: `px-6 md:px-10`.
- **Header içerikten ayrık:** sticky üst bar, `border-bottom: var(--line)`. Ana ekranda ayrıca "SEPETLER" ayraç şeridi (üst çizgi + label + sayı).
- Kart radius: `rounded-2xl` (kart), `rounded-3xl` (öne çıkan/sonuç), `rounded-full` (buton/pill/chip).
- Grid: ana ekran `md:grid-cols-2`; öne çıkan (canlı) tam genişlik + `--black`.
- Presenter: **shell yok, tam ekran** `.presenter-stage` (`--black`).

---

## 5. Componentler

**Kart (sepet):** `--card` zemin, `--line` kenar, hover'da kenar aksan + `0 18px 40px -24px <glow>` gölge. İçerik: mod chip (dot+label, aksan) · başlık (display) · mini bar / kura chip · alt şerit (avatarlar + oy sayısı).

**Öne çıkan / canlı:** `--black` zemin, aksan glow gölge, "ŞU AN CANLI" chip, dev başlık, canlı barlar, avatar + oy.

**Canlı oy barı (LiveVotePanel):** sıralı satır kartları; dolgu = `--*-soft` (lider tam aksan, diğerleri soluk); sağda `AnimatedNumber` (lider aksan renginde); "oy ver" pill (`--ink` zemin / `--paper` metin, oyum verilince aksan). Lider satır: aksan kenar + glow.

**AnimatedNumber:** `useSpring`+`useTransform` (Motion+ gerektirmez). Değer değişince yumuşak kayar. Bkz. `components/shared/AnimatedNumber.tsx`.

**Avatar yığını:** isimden hash → sıcak palet (`#D97757 #E3A857 #C88B5A #B07C63 #9A8E7E`); üst üste `-8px`, `--card` kenar.

**Buton:** primary = `--clay`/`--gold` zemin (metin beyaz) VEYA `--ink` zemin (metin `--black`); ghost = aksan kenar + aksan metin; hepsi `rounded-full`.

**Chip / pill:** `--*-soft` zemin + aksan metin, `rounded-full`.

**StatusPill:** dot (canlıysa aksan + `box-shadow` halka) + "canlı".

---

## 6. Motion (Motion / framer-motion, ücretsiz)

- Spring temel: `stiffness: 300–400, damping: 30–34`. Bar dolumu: `stiffness: 120–140`.
- Reveal: kart enter `y+opacity`, stagger `~0.05*i`.
- **Kura ("Lights Out"):** tam ekran kararır, ortada dev isim döner (motion blur), yavaşlar, kazananda scale+glow + `canvas-confetti`. İMZA an.
- Hero dönen kelime: `inline-grid` yığılı, spring `y` kayma.
- `prefers-reduced-motion` → animasyonlar kısılır (globals'ta global kural + confetti/shuffle atlanır).
- **Aşırıya kaçma:** grid'i ağır stagger'lama, buton hover'ında abartma. Motion sadece canlı veri + reveal + presenter geçişinde yoğun.

---

## 7. Do / Don't

| ✅ Do | ❌ Don't |
|---|---|
| Nötr-sıcak gri zemin | Soğuk mavi-gri / cıvık sıcak zemin |
| Clay ana, gold ikincil | Mor / yeşil / mavi ana aksan |
| Hero tek satır, yan yana | Hero alt alta / kelime çakışması |
| Canlı veri ile doldur (bar+avatar+sayı) | Boş çıplak ekran |
| Tek hero-aksan restraint | Her yere renk/efekt (panayır) |
| `--black` = canlı/önemli katman | Canlı olanı zeminle aynı yapmak |
| Motion "wow" anına sakla | Her şeyi animasyonla |

---

## 8. Kodda nerede

- **Token'lar:** `app/globals.css` (`:root`) — renk değişince tek yer.
- **Fontlar:** `app/layout.tsx`.
- **Ana ekran (referans ekran):** `app/page.tsx` — palet `C` sabiti + `Featured`/`RichCard`/`MiniBars`/`RotatingQuestion`.
- **Ortak:** `components/shared/` (LiveVotePanel, AnimatedNumber, Avatars, ResultScreen, StatusPill).
- **Presenter:** `app/basket/[id]/present/page.tsx` (kendi koyu sahnesi, `VIOLET`=gold sabiti).

> Renk yönü değişirse: `globals.css` token'ları + `app/page.tsx` `C` + presenter `VIOLET` = üç yer. Hepsi bu dosyadaki tabloyla senkron kalmalı.

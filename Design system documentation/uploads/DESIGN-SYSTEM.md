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

### Zemin katmanları (koyu → açık derinlik)
| Token | Hex | Kullanım |
|---|---|---|
| `--black` | `#1A1A17` | **Canlı / sahne / sonuç** — en dramatik, spotlight katman |
| `--bg` | `#232320` | Sayfa zemini (nötr-sıcak koyu gri) |
| `--card` | `#2C2C28` | Kartlar — zeminden hafif kalkık |
| `--surface-2` | `#363631` | Input / elevated yüzey |

> Katman mantığı: **canlı/önemli olan `--black` (en koyu, en dikkat çeken)**, kartlar `--card`, zemin arada.

### Metin
| Token | Hex | Kullanım |
|---|---|---|
| `--text` | `#F3F1EA` | Ana metin (krem, saf beyaz değil) |
| `--text-muted` | `#A3A099` | İkincil, etiket, meta |
| `--line` | `rgba(240,238,230,0.10)` | Kenar / ayraç |
| `--line-strong` | `rgba(240,238,230,0.20)` | Belirgin kenar |

### Aksanlar
| Token | Hex | Anlam |
|---|---|---|
| `--clay` (`--social`) | `#D97757` | **Ana aksan** · sosyal mod · aksiyon · vurgu · lider bar/sayı |
| `--gold` (`--build`) | `#E3A857` | **İkincil aksan** · build / hackathon modu |
| `--danger` | `#D97757` | Hata (şimdilik clay) |

**Soft/glow** her aksanın var: `--clay-soft` (%16 opak dolgu), `--clay-glow` (gölge). Aynısı gold için.

### KESİN kurallar
- ❌ **Soğuk mavi-gri zemin yok.** ❌ Cıvık turuncu/sıcak-abartı zemin yok. ✅ Nötr-sıcak gri.
- ❌ Mor, yeşil, mavi **ana aksan** olarak yok.
- ✅ Multi-color olabilir ama **sadece clay + gold** (sıcak, uyumlu). Üçüncü hue eklenmez.
- Buton/label metni aksan üstünde: `--black` (koyu) ya da beyaz — kontrast neyse.

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

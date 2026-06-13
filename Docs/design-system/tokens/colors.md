# Design Tokens — Renkler

Kaynak: [yildizholding.com.tr](https://www.yildizholding.com.tr/) kurumsal web sitesi CSS (`--bs-primary`, `--bs-body-*`).

Uygulama tek doğruluk kaynağı: `apps/web/src/styles/brand-tokens.ts` + `theme.ts` (MUI `createTheme`). Bu dosya token tanımı ve semantik eşlemedir.

## Marka paleti

| Token | Hex | Kullanım |
| --- | --- | --- |
| `brand.red.primary` | `#EB1C2E` | Primary buton, link, vurgu, AppBar aksan |
| `brand.red.meta` | `#D30E1D` | PWA / tile rengi (referans; UI primary `#EB1C2E`) |
| `brand.red.light` | `#FBF5F6` | Hafif kırmızı arka plan (hover/highlight) |
| `brand.black` | `#000000` | Birincil metin |
| `brand.white` | `#FFFFFF` | Kart, header, paper arka plan |
| `brand.gray.50` | `#F8F8F8` | Sayfa arka plan (default) |
| `brand.gray.100` | `#F3F1F2` | Bölüm / alternatif yüzey |
| `brand.gray.200` | `#E3E3E3` | Ayırıcı, border hafif |
| `brand.gray.400` | `#636466` | İkincil metin, placeholder |
| `brand.gray.500` | `#6C757D` | Devre dışı, caption |
| `brand.gray.900` | `#0D1B2E` | Koyu başlık (opsiyonel vurgu) |

## MUI palette eşlemesi

| MUI token | Değer | Not |
| --- | --- | --- |
| `palette.primary.main` | `#EB1C2E` | Yapıcı aksiyonlar |
| `palette.primary.light` | `#F44350` | Hover / focus ring |
| `palette.primary.dark` | `#C41928` | Active / pressed |
| `palette.text.primary` | `#000000` | Body |
| `palette.text.secondary` | `#636466` | Yardımcı metin |
| `palette.background.default` | `#F8F8F8` | Sayfa zemini |
| `palette.background.paper` | `#FFFFFF` | Kart, modal |
| `palette.divider` | `#E3E3E3` | Border |
| `palette.error.main` | `#EB1C2E` | Destructive onay (site primary kırmızısı) |

## Kurallar

- Bileşenlerde **hardcoded hex yasak** — `theme.palette.*`, `color="primary"` veya `sx` ile theme referansı.
- Durum göstergeleri (SLA, workflow) yalnızca semantik renk (`success`, `warning`, `error`) + ikon + metin; tek başına renk anlam taşımaz.
- Tüm metin/arka plan çiftleri WCAG AA kontrast (4.5:1 normal, 3:1 büyük metin).

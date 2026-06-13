# Yıldız Holding — Etik Bildirim Design System

Kurumsal referans: [yildizholding.com.tr](https://www.yildizholding.com.tr/). Uygulama **MUI 6** ile implement edilir; Bootstrap class'ları kopyalanmaz — görsel dil token + `theme.ts` override ile eşlenir.

## Katmanlar

| Katman | Konum | Rol |
| --- | --- | --- |
| Token | `tokens/*.md` | Renk, tipografi, spacing, efekt tanımları |
| Bileşen spec | `components/*.md` | MUI eşlemesi, varyant kuralları |
| Kod | `apps/web/src/styles/` | `brand-tokens.ts`, `theme.ts` |
| Wrapper | `apps/web/src/components/brand/` | Logo, PageHeader, Section, FormPanel, BrandedPublicShell |

## Kullanım kuralları

1. Yeni renk/spacing → önce `tokens/` docs, sonra `brand-tokens.ts` + `theme.ts`.
2. Feature kodunda hardcoded hex yasak — `theme.palette`, `sx` theme callback.
3. Harici CDN font/script yasak — `@fontsource/poppins`.
4. Marketing-only kalıplar (slider, mega menu) MVP dışı.

## MUI eşleme özeti

| Kurumsal site | MUI |
| --- | --- |
| `.btn-primary` | `Button variant="contained" color="primary"` |
| `.btn-primary:hover` (outline invert) | `MuiButton` containedPrimary override |
| `#header` sticky beyaz | `AppBar color="default"` |
| `.page-content` padding | `Container` + `PageHeader` |
| `.bg-half-grey` | `Box bgcolor="grey.100"` |

Detay: `Docs/05_FRONTEND_SPEC.md` §Brand & Theme; `.cursor/rules/26-frontend-theme.mdc`.

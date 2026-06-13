# Design Tokens — Tipografi

Kaynak: [yildizholding.com.tr](https://www.yildizholding.com.tr/) — `--bs-font-sans-serif: "Poppins", system-ui, …`

## Font ailesi

| Token | Değer |
| --- | --- |
| `font.family.primary` | `"Poppins", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` |

Dekoratif fontlar (ör. site timeline'da `Gloria Hallelujah`) MVP UI'da **kullanılmaz**.

## Yükleme

- Harici CDN (Google Fonts vb.) **yasak** — `03-security-baseline`, `05_FRONTEND_SPEC`.
- `@fontsource/poppins` npm paketi; `main.tsx` içinde self-host import:

```typescript
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
```

## Ağırlıklar

| Kullanım | weight |
| --- | --- |
| Body, form label | 400 |
| Button, nav link | 500 |
| h5, h6, subtitle | 600 |
| h4, h3, AppBar başlık | 600–700 |

## MUI typography eşlemesi

`theme.ts` → `typography.fontFamily` = Poppins stack; `h4`/`h5` `fontWeight: 600`; `button` `fontWeight: 500`, `textTransform: 'none'`.

Monospace (tracking code vb.): `"Roboto Mono", ui-monospace, monospace` — yalnızca kod/takip alanlarında.

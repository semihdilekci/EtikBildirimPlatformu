# Bileşen — Button

Kurumsal referans: `.btn-primary` (app.min.css + libs.min.css).

## Varyantlar

| Varyant | MUI | Görünüm |
| --- | --- | --- |
| Primary | `variant="contained" color="primary"` | Kırmızı dolu, beyaz metin |
| Primary hover | theme override | Beyaz zemin, kırmızı border + metin |
| Secondary | `variant="outlined" color="primary"` | Kırmızı outline |
| Ghost / link | `variant="text" color="primary"` | Metin buton |
| Destructive | `variant="contained" color="error"` | Onay dialog red (marka kırmızısı) |

## Ölçüler

| Özellik | Değer |
| --- | --- |
| Border radius | `0` (keskin köşe — site `.btn`) |
| Padding | `12px 22px` (≈ site `1.157rem 1.4rem`) |
| Font | Poppins **700**, 0.75rem (site `.btn`) |
| Text transform | none |

## Davranış

```tsx
// ✓ Doğru
<Button variant="contained" color="primary">Gönder</Button>

// ✗ Yanlış — hardcoded stil
<Button sx={{ backgroundColor: '#EB1C2E' }}>Gönder</Button>
```

## theme.ts override

`MuiButton.styleOverrides`: `root`, `containedPrimary`, `outlinedPrimary` — detay `apps/web/src/styles/theme.ts`.

Loading state: `disabled` + `CircularProgress`; metin kaybolmaz (a11y).

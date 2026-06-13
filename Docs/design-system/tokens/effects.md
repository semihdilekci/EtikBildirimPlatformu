# Design Tokens — Effects

Kaynak: yildizholding.com.tr CSS (transition, box-shadow, focus).

## Gölge

| Token | Değer | Kullanım |
| --- | --- | --- |
| `shadow.header` | `0 0 5px rgba(0,0,0,0.12)` | Sticky AppBar (`#header.sticky`) |
| `shadow.none` | none | Kart varsayılan (flat + border) |
| `shadow.focus` | `0 0 0 4px rgba(235,28,46,0.35)` | Buton/input focus ring |

Kurumsal sitede kartlarda ağır gölge yok; flat yüzey + ince border tercih edilir.

## Geçiş

| Token | Değer |
| --- | --- |
| `motion.fast` | `0.15s ease-in-out` |
| `motion.medium` | `0.2s ease-in-out` |
| `motion.reduced` | `prefers-reduced-motion: reduce` → transition none |

## Border radius

| Token | Değer | Kullanım |
| --- | --- | --- |
| `radius.button` | `0` | Primary/secondary buton (site `.btn`) |
| `radius.sm` | 8px | Input, kart (operasyon UI) |
| `radius.md` | 12px | Modal, büyük kart |
| `radius.pill` | 9999px | Yalnızca `.btn-circle` — MVP dışı |

## Focus (a11y)

- Focus ring rengi: primary kırmızı alpha (`rgba(235,28,46,0.35)`).
- `:focus-visible` kullan; mouse click focus ring gösterme (MUI default + override).
- Minimum kontrast: `Docs/05_FRONTEND_SPEC.md` §Color contrast.

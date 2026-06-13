# Bileşen — Layout Wrapper'ları

Konum: `apps/web/src/components/brand/`.

## BrandedPublicShell

Public intake + tracking layout iskeleti: AppBar (logo, subtitle, nav link), main container, KVKK footer.

```tsx
<BrandedPublicShell logoTo="/report" subtitle="Etik Bildirim" navLink={{ to: '/tracking', label: '...' }}>
  <Outlet />
</BrandedPublicShell>
```

## PageHeader

Sayfa başlığı + opsiyonel alt başlık. `align="center"` public formlar için.

## FormPanel

Ortalanmış form genişliği (`maxWidth` default 480).

## Section

Bölüm arka planı: `variant="muted"` → `grey.100` (kurumsal `.bg-half-grey`).

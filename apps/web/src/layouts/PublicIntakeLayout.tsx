import { Outlet } from 'react-router-dom';

import { BrandedPublicShell } from '@/components/brand';

export function PublicIntakeLayout() {
  return (
    <BrandedPublicShell
      logoTo="/report"
      subtitle="Etik Bildirim"
      navLink={{ to: '/tracking', label: 'Bildirim Takibi' }}
    >
      <Outlet />
    </BrandedPublicShell>
  );
}

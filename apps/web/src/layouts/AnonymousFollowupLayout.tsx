import { Outlet } from 'react-router-dom';

import { BrandedPublicShell } from '@/components/brand';
import { TrackingProvider } from '@/features/tracking/context/TrackingContext';

export function AnonymousFollowupLayout() {
  return (
    <TrackingProvider>
      <BrandedPublicShell
        logoTo="/tracking"
        subtitle="Bildirim Takip"
        navLink={{ to: '/report', label: 'Yeni Bildirim' }}
      >
        <Outlet />
      </BrandedPublicShell>
    </TrackingProvider>
  );
}

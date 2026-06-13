import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { TrackingProvider } from '@/features/tracking/context/TrackingContext';
import { TrackingGuard } from '@/routes/guards/TrackingGuard';

function StatusPlaceholder() {
  return <div>Durum ekranı</div>;
}

describe('TrackingGuard', () => {
  it('redirects unauthenticated users to /tracking', () => {
    render(
      <MemoryRouter initialEntries={['/tracking/status']}>
        <Routes>
          <Route
            element={
              <TrackingProvider>
                <TrackingGuard />
              </TrackingProvider>
            }
          >
            <Route path="/tracking/status" element={<StatusPlaceholder />} />
          </Route>
          <Route path="/tracking" element={<div>Giriş ekranı</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Giriş ekranı')).toBeInTheDocument();
  });
});

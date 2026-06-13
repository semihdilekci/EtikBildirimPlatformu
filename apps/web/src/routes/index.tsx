import { Navigate, Route, Routes } from 'react-router-dom';

import { AuthCallbackPage } from '@/features/auth/pages/AuthCallbackPage';
import { DashboardPage } from '@/features/auth/pages/DashboardPage';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { NotFoundPage } from '@/features/system/pages/NotFoundPage';
import { InternalLayout } from '@/layouts/InternalLayout';
import { AuthGuard } from '@/routes/guards/AuthGuard';
import { GuestGuard } from '@/routes/guards/GuestGuard';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/auth/login" replace />} />

      <Route element={<GuestGuard />}>
        <Route path="/auth/login" element={<LoginPage />} />
      </Route>

      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      <Route element={<AuthGuard />}>
        <Route path="/app" element={<InternalLayout />}>
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

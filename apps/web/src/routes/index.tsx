import { Navigate, Route, Routes } from 'react-router-dom';
import { Role } from '@ethics/shared';

import { AdminPlaceholderPage } from '@/features/admin/pages/AdminPlaceholderPage';
import { AuthCallbackPage } from '@/features/auth/pages/AuthCallbackPage';
import { DashboardPage } from '@/features/auth/pages/DashboardPage';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { CaseDetailPage } from '@/features/cases/pages/CaseDetailPage';
import { CaseListPage } from '@/features/cases/pages/CaseListPage';
import { TaskDetailPage } from '@/features/tasks/pages/TaskDetailPage';
import { TaskListPage } from '@/features/tasks/pages/TaskListPage';
import { NotificationCenterPage } from '@/features/notifications/pages/NotificationCenterPage';
import { ReportFormPage } from '@/features/intake/pages/ReportFormPage';
import { ReportSuccessPage } from '@/features/intake/pages/ReportSuccessPage';
import { TrackingLoginPage } from '@/features/tracking/pages/TrackingLoginPage';
import { TrackingMessagesPage } from '@/features/tracking/pages/TrackingMessagesPage';
import { TrackingStatusPage } from '@/features/tracking/pages/TrackingStatusPage';
import { ForbiddenPage } from '@/features/system/pages/ForbiddenPage';
import { NotFoundPage } from '@/features/system/pages/NotFoundPage';
import { AdminLayout } from '@/layouts/AdminLayout';
import { AnonymousFollowupLayout } from '@/layouts/AnonymousFollowupLayout';
import { InternalLayout } from '@/layouts/InternalLayout';
import { PublicIntakeLayout } from '@/layouts/PublicIntakeLayout';
import { AuthGuard } from '@/routes/guards/AuthGuard';
import { GuestGuard } from '@/routes/guards/GuestGuard';
import { RoleGuard } from '@/routes/guards/RoleGuard';
import { TrackingGuard } from '@/routes/guards/TrackingGuard';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/report" replace />} />

      <Route element={<PublicIntakeLayout />}>
        <Route path="/report" element={<ReportFormPage />} />
        <Route path="/report/success" element={<ReportSuccessPage />} />
      </Route>

      <Route element={<AnonymousFollowupLayout />}>
        <Route path="/tracking" element={<TrackingLoginPage />} />
        <Route element={<TrackingGuard />}>
          <Route path="/tracking/status" element={<TrackingStatusPage />} />
          <Route path="/tracking/messages" element={<TrackingMessagesPage />} />
        </Route>
      </Route>

      <Route element={<GuestGuard />}>
        <Route path="/auth/login" element={<LoginPage />} />
      </Route>

      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      <Route path="/403" element={<ForbiddenPage />} />

      <Route element={<AuthGuard />}>
        <Route path="/app" element={<InternalLayout />}>
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="cases" element={<CaseListPage />} />
          <Route path="cases/:id" element={<CaseDetailPage />} />
          <Route path="tasks" element={<TaskListPage />} />
          <Route path="tasks/:id" element={<TaskDetailPage />} />
          <Route path="notifications" element={<NotificationCenterPage />} />
        </Route>

        <Route element={<RoleGuard roles={[Role.ADMIN]} />}>
          <Route path="/app/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/app/admin/users" replace />} />
            <Route path="users" element={<AdminPlaceholderPage title="Kullanıcı Yönetimi" />} />
            <Route
              path="master-data"
              element={<AdminPlaceholderPage title="Master Data Senkron" />}
            />
            <Route path="settings" element={<AdminPlaceholderPage title="Sistem Ayarları" />} />
            <Route
              path="field-visibility"
              element={<AdminPlaceholderPage title="Alan Görünürlüğü" />}
            />
            <Route path="system-health" element={<AdminPlaceholderPage title="Sistem Sağlığı" />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

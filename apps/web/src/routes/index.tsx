import { Navigate, Route, Routes } from 'react-router-dom';
import { Role } from '@ethics/shared';

import { AdminUserDetailPage } from '@/features/admin/pages/AdminUserDetailPage';
import { AdminUserListPage } from '@/features/admin/pages/AdminUserListPage';
import { AdminActionMatrixPage } from '@/features/admin/pages/AdminActionMatrixPage';
import { AdminAuditPage } from '@/features/admin/pages/AdminAuditPage';
import { AdminBusinessCalendarPage } from '@/features/admin/pages/AdminBusinessCalendarPage';
import { AdminDocumentOpsPage } from '@/features/admin/pages/AdminDocumentOpsPage';
import { AdminFieldVisibilityPage } from '@/features/admin/pages/AdminFieldVisibilityPage';
import { AdminKvkkTextsPage } from '@/features/admin/pages/AdminKvkkTextsPage';
import { AdminNotificationTemplatesPage } from '@/features/admin/pages/AdminNotificationTemplatesPage';
import { AdminMasterDataPage } from '@/features/admin/pages/AdminMasterDataPage';
import { AdminSlaPoliciesPage } from '@/features/admin/pages/AdminSlaPoliciesPage';
import { AdminSystemSettingsPage } from '@/features/admin/pages/AdminSystemSettingsPage';
import { AdminSystemHealthPage } from '@/features/admin/pages/AdminSystemHealthPage';
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
import { AdminIndexRedirect } from '@/routes/AdminIndexRedirect';
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

        <Route path="/app/admin" element={<AdminLayout />}>
          <Route index element={<AdminIndexRedirect />} />
          <Route element={<RoleGuard roles={[Role.ADMIN, Role.COUNCIL_SECRETARY]} />}>
            <Route path="kvkk-texts" element={<AdminKvkkTextsPage />} />
          </Route>
          <Route element={<RoleGuard roles={[Role.ADMIN]} />}>
            <Route path="users" element={<AdminUserListPage />} />
            <Route path="users/:id" element={<AdminUserDetailPage />} />
            <Route path="master-data" element={<AdminMasterDataPage />} />
            <Route path="settings" element={<AdminSystemSettingsPage />} />
            <Route path="field-visibility" element={<AdminFieldVisibilityPage />} />
            <Route path="action-matrix" element={<AdminActionMatrixPage />} />
            <Route path="sla-policies" element={<AdminSlaPoliciesPage />} />
            <Route path="business-calendar" element={<AdminBusinessCalendarPage />} />
            <Route path="notification-templates" element={<AdminNotificationTemplatesPage />} />
            <Route path="audit" element={<AdminAuditPage />} />
            <Route path="document-ops" element={<AdminDocumentOpsPage />} />
            <Route path="system-health" element={<AdminSystemHealthPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

import { Alert, Box, Snackbar } from '@mui/material';
import { PermissionCode } from '@ethics/policy';
import { useState } from 'react';

import { PageHeader } from '@/components/brand';
import { PermissionGate } from '@/features/auth/components/PermissionGate';
import { NotificationList } from '@/features/notifications/components/NotificationList';
import { useNotificationNavigation } from '@/features/notifications/hooks/useNotifications';

export function NotificationCenterPage() {
  const { navigateToNotification, isMarkingRead } = useNotificationNavigation();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  return (
    <PermissionGate
      permission={PermissionCode.NOTIFICATION_LIST}
      fallback={
        <Alert severity="warning" role="alert">
          Bildirimleri görüntüleme yetkiniz bulunmuyor.
        </Alert>
      }
    >
      <PageHeader
        title="Bildirim Merkezi"
        subtitle="In-app bildirimlerinizi görüntüleyin ve ilgili kaynaklara gidin."
      />

      <Box sx={{ maxWidth: 720 }}>
        <NotificationList
          enablePolling
          isNavigating={isMarkingRead}
          onNotificationClick={(notification) => {
            void navigateToNotification(notification, () => {
              setToastMessage('Bu kaynağa erişim yetkiniz yok');
            });
          }}
        />
      </Box>

      <Snackbar
        open={Boolean(toastMessage)}
        autoHideDuration={5000}
        onClose={() => {
          setToastMessage(null);
        }}
        message={toastMessage ?? ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </PermissionGate>
  );
}

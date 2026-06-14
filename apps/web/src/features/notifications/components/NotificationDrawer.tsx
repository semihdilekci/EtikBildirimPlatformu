import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import { Box, Drawer, IconButton, Snackbar, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { NotificationList } from '@/features/notifications/components/NotificationList';
import { useNotificationNavigation } from '@/features/notifications/hooks/useNotifications';
import { useNotificationCenterStore } from '@/stores/useNotificationCenterStore';

const DRAWER_WIDTH = 360;

export function NotificationDrawer() {
  const navigate = useNavigate();
  const drawerOpen = useNotificationCenterStore((state) => state.drawerOpen);
  const closeDrawer = useNotificationCenterStore((state) => state.closeDrawer);
  const { navigateToNotification, isMarkingRead } = useNotificationNavigation();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleViewAll = () => {
    closeDrawer();
    void navigate('/app/notifications');
  };

  return (
    <>
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={closeDrawer}
        ModalProps={{ keepMounted: true }}
        sx={{
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: DRAWER_WIDTH,
          },
        }}
      >
        <Stack spacing={2} sx={{ height: '100%', p: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6" component="h2">
              Bildirimler
            </Typography>
            <IconButton onClick={closeDrawer} aria-label="Bildirim panelini kapat">
              <CloseOutlinedIcon />
            </IconButton>
          </Stack>

          <Box sx={{ flex: 1, minHeight: 0 }}>
            <NotificationList
              compact
              enablePolling={drawerOpen}
              showViewAllLink
              onViewAllClick={handleViewAll}
              isNavigating={isMarkingRead}
              onNotificationClick={(notification) => {
                void navigateToNotification(notification, () => {
                  setToastMessage('Bu kaynağa erişim yetkiniz yok');
                });
              }}
            />
          </Box>
        </Stack>
      </Drawer>

      <Snackbar
        open={Boolean(toastMessage)}
        autoHideDuration={5000}
        onClose={() => {
          setToastMessage(null);
        }}
        message={toastMessage ?? ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
}

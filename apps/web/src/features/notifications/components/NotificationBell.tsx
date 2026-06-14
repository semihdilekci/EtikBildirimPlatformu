import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import { Badge, IconButton } from '@mui/material';
import { PermissionCode } from '@ethics/policy';

import { NotificationDrawer } from '@/features/notifications/components/NotificationDrawer';
import { useUnreadNotificationCountQuery } from '@/features/notifications/hooks/useNotifications';
import { PermissionGate } from '@/features/auth/components/PermissionGate';
import { useNotificationCenterStore } from '@/stores/useNotificationCenterStore';

export function NotificationBell() {
  const openDrawer = useNotificationCenterStore((state) => state.openDrawer);
  const unreadCountQuery = useUnreadNotificationCountQuery();
  const unreadCount = unreadCountQuery.data?.count ?? 0;

  return (
    <PermissionGate permission={PermissionCode.NOTIFICATION_LIST}>
      <IconButton color="inherit" onClick={openDrawer} aria-label="Bildirimleri aç">
        <Badge badgeContent={unreadCount} color="error" max={99} invisible={unreadCount === 0}>
          <NotificationsOutlinedIcon />
        </Badge>
      </IconButton>
      <NotificationDrawer />
    </PermissionGate>
  );
}

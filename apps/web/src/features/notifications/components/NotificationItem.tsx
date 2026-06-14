import { Box, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import type { NotificationListItem } from '@ethics/dto';

import { getNotificationIcon } from '@/features/notifications/components/NotificationIcon';
import { formatNotificationRelativeTime } from '@/features/notifications/utils/notification-format.util';

type NotificationItemProps = {
  notification: NotificationListItem;
  onClick: (notification: NotificationListItem) => void;
  disabled?: boolean;
};

export function NotificationItem({
  notification,
  onClick,
  disabled = false,
}: NotificationItemProps) {
  return (
    <ListItemButton
      alignItems="flex-start"
      disabled={disabled}
      onClick={() => {
        onClick(notification);
      }}
      sx={{
        borderLeft: notification.isRead ? '3px solid transparent' : '3px solid',
        borderLeftColor: notification.isRead ? 'transparent' : 'primary.main',
        py: 1.5,
      }}
    >
      <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}>
        {getNotificationIcon(notification)}
      </ListItemIcon>
      <ListItemText
        primary={
          <Typography variant="body2" fontWeight={notification.isRead ? 400 : 600} component="span">
            {notification.title}
          </Typography>
        }
        secondary={
          <Box component="span" sx={{ display: 'block' }}>
            <Typography variant="caption" color="text.secondary" component="span" display="block">
              {notification.body}
            </Typography>
            <Typography variant="caption" color="text.disabled" component="span">
              {formatNotificationRelativeTime(notification.createdAt)}
            </Typography>
          </Box>
        }
      />
    </ListItemButton>
  );
}

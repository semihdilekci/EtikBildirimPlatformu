import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  List,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import type { NotificationListItem } from '@ethics/dto';
import type { MouseEvent } from 'react';
import { useState } from 'react';

import { NotificationItem } from '@/features/notifications/components/NotificationItem';
import {
  useMarkAllNotificationsReadMutation,
  useNotificationsListQuery,
  useUnreadNotificationCountQuery,
} from '@/features/notifications/hooks/useNotifications';

const THIRTY_SECONDS_MS = 30 * 1000;

type NotificationFilter = 'all' | 'unread';

type NotificationListProps = {
  onNotificationClick: (notification: NotificationListItem) => void;
  isNavigating?: boolean;
  compact?: boolean;
  showViewAllLink?: boolean;
  onViewAllClick?: () => void;
  enablePolling?: boolean;
};

export function NotificationList({
  onNotificationClick,
  isNavigating = false,
  compact = false,
  showViewAllLink = false,
  onViewAllClick,
  enablePolling = false,
}: NotificationListProps) {
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [cursor, setCursor] = useState<string | null>(null);

  const listQuery = useNotificationsListQuery(
    {
      limit: compact ? 10 : 20,
      ...(filter === 'unread' ? { isRead: false } : {}),
      ...(cursor ? { cursor } : {}),
    },
    {
      refetchInterval: enablePolling ? THIRTY_SECONDS_MS : false,
    },
  );

  const markAllReadMutation = useMarkAllNotificationsReadMutation();
  const unreadCountQuery = useUnreadNotificationCountQuery();

  const handleFilterChange = (
    _event: MouseEvent<HTMLElement>,
    nextFilter: NotificationFilter | null,
  ) => {
    if (!nextFilter) {
      return;
    }

    setFilter(nextFilter);
    setCursor(null);
  };

  const handleMarkAllRead = async () => {
    await markAllReadMutation.mutateAsync();
  };

  const notifications = listQuery.data?.data ?? [];
  const hasMore = listQuery.data?.pagination.hasMore ?? false;
  const isInitialLoading = listQuery.isPending && !listQuery.data;
  const unreadCount = unreadCountQuery.data?.count ?? 0;

  return (
    <Stack spacing={2} sx={{ height: '100%' }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={1}
        flexWrap="wrap"
      >
        <ToggleButtonGroup
          exclusive
          size="small"
          value={filter}
          onChange={handleFilterChange}
          aria-label="Bildirim filtresi"
        >
          <ToggleButton value="all" aria-label="Tüm bildirimler">
            Tümü
          </ToggleButton>
          <ToggleButton value="unread" aria-label="Okunmamış bildirimler">
            Okunmamış
          </ToggleButton>
        </ToggleButtonGroup>

        <Button
          size="small"
          onClick={() => void handleMarkAllRead()}
          disabled={markAllReadMutation.isPending || unreadCount === 0}
        >
          Tümünü Okundu İşaretle
        </Button>
      </Stack>

      {listQuery.isError ? (
        <Alert severity="error" role="alert">
          Bildirimler yüklenemedi.
        </Alert>
      ) : null}

      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {isInitialLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} aria-label="Bildirimler yükleniyor" />
          </Box>
        ) : notifications.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            Bildiriminiz bulunmuyor.
          </Typography>
        ) : (
          <List disablePadding aria-label="Bildirim listesi">
            {notifications.map((notification, index) => (
              <Box key={notification.id}>
                <NotificationItem
                  notification={notification}
                  onClick={onNotificationClick}
                  disabled={isNavigating}
                />
                {index < notifications.length - 1 ? <Divider component="li" /> : null}
              </Box>
            ))}
          </List>
        )}
      </Box>

      {!compact && hasMore ? (
        <Button
          variant="outlined"
          size="small"
          onClick={() => {
            const nextCursor = listQuery.data?.pagination.nextCursor;
            if (nextCursor) {
              setCursor(nextCursor);
            }
          }}
          disabled={listQuery.isFetching}
        >
          Daha Fazla Yükle
        </Button>
      ) : null}

      {showViewAllLink && onViewAllClick ? (
        <Button variant="text" size="small" onClick={onViewAllClick}>
          Tüm bildirimleri gör
        </Button>
      ) : null}
    </Stack>
  );
}

import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import MessageOutlinedIcon from '@mui/icons-material/MessageOutlined';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { ErrorCode, type ReportStatusCode } from '@ethics/shared';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { StatusBadge } from '@/features/tracking/components/StatusBadge';
import { useTrackingAuth } from '@/features/tracking/hooks/useTrackingAuth';
import { useTrackingStatusQuery } from '@/features/tracking/hooks/useTrackingStatus';
import { maskTrackingCode } from '@/features/tracking/utils/mask-tracking-code.util';
import { getTrackingErrorMessage } from '@/features/tracking/utils/tracking-error.util';
import { ApiError } from '@/types/api.types';

function formatTrackingDate(isoDate: string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(isoDate));
}

export function TrackingStatusPage() {
  const navigate = useNavigate();
  const { credentials, hasUnreadMessages, clearCredentials } = useTrackingAuth();
  const statusQuery = useTrackingStatusQuery();

  useEffect(() => {
    if (
      statusQuery.isError &&
      statusQuery.error instanceof ApiError &&
      statusQuery.error.status === 401
    ) {
      clearCredentials();
      void navigate('/tracking', {
        replace: true,
        state: { sessionExpired: true },
      });
    }
  }, [clearCredentials, navigate, statusQuery.error, statusQuery.isError]);

  const handleLogout = () => {
    clearCredentials();
    void navigate('/tracking', { replace: true });
  };

  const maskedCode = credentials
    ? maskTrackingCode(credentials.trackingCode)
    : statusQuery.data
      ? maskTrackingCode(statusQuery.data.trackingCode)
      : 'ETK-****-****';

  if (statusQuery.isPending) {
    return (
      <Box sx={{ maxWidth: 640, mx: 'auto' }}>
        <Stack spacing={3}>
          <Skeleton variant="rounded" height={72} />
          <Skeleton variant="rounded" height={160} />
          <Skeleton variant="rounded" height={48} width="40%" sx={{ mx: 'auto' }} />
        </Stack>
      </Box>
    );
  }

  if (statusQuery.isError) {
    const isAuthError =
      statusQuery.error instanceof ApiError &&
      (statusQuery.error.status === 401 ||
        statusQuery.error.code === ErrorCode.AUTH_INVALID_CREDENTIALS);

    if (isAuthError) {
      return null;
    }

    return (
      <Box sx={{ maxWidth: 640, mx: 'auto' }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => void statusQuery.refetch()}>
              Tekrar Dene
            </Button>
          }
        >
          {getTrackingErrorMessage(statusQuery.error, 'Durum bilgisi alınamadı.')}
        </Alert>
      </Box>
    );
  }

  const statusData = statusQuery.data;

  return (
    <Box sx={{ maxWidth: 640, mx: 'auto' }}>
      <Stack spacing={3}>
        <Stack spacing={0.5} textAlign="center">
          <Typography variant="h4" component="h1">
            Bildirim Durumu
          </Typography>
          <Typography variant="body2" color="text.secondary" fontFamily="monospace">
            {maskedCode}
          </Typography>
        </Stack>

        <Tabs
          value="status"
          onChange={(_, value) => {
            if (value === 'messages') {
              void navigate('/tracking/messages');
            }
          }}
          variant="fullWidth"
          aria-label="Takip navigasyonu"
        >
          <Tab label="Durum" value="status" aria-current="page" />
          <Tab label="Mesajlar" value="messages" />
        </Tabs>

        <Card variant="outlined">
          <CardContent>
            <StatusBadge
              status={statusData.status as ReportStatusCode}
              label={statusData.statusLabel}
            />
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1.5}>
              <Typography variant="body2" color="text.secondary">
                Gönderim tarihi:{' '}
                <Typography component="span" variant="body2" color="text.primary">
                  {formatTrackingDate(statusData.submittedAt)}
                </Typography>
              </Typography>
              {statusData.lastActivityAt ? (
                <Typography variant="body2" color="text.secondary">
                  Son güncelleme:{' '}
                  <Typography component="span" variant="body2" color="text.primary">
                    {formatTrackingDate(statusData.lastActivityAt)}
                  </Typography>
                </Typography>
              ) : null}
            </Stack>
          </CardContent>
        </Card>

        {hasUnreadMessages ? (
          <Alert
            severity="info"
            icon={<MailOutlineIcon aria-hidden />}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() => void navigate('/tracking/messages')}
              >
                Mesajlara Git
              </Button>
            }
          >
            Kurul sekretaryasından yeni bir mesajınız var.
          </Alert>
        ) : null}

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
          <Button
            variant="contained"
            startIcon={<MessageOutlinedIcon />}
            onClick={() => void navigate('/tracking/messages')}
          >
            Mesajlar
          </Button>
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<LogoutOutlinedIcon />}
            onClick={handleLogout}
          >
            Çıkış
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

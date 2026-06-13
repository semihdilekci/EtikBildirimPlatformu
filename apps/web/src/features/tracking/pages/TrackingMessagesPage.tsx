import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { zodResolver } from '@hookform/resolvers/zod';
import { sendSecureMessageBodySchema, type SendSecureMessageBody } from '@ethics/dto';
import { SecureMessageApiDirection } from '@ethics/shared';
import { useEffect, useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

import {
  useSendTrackingMessageMutation,
  useTrackingMessagesQuery,
} from '@/features/tracking/hooks/useTrackingMessages';
import { useTrackingAuth } from '@/features/tracking/hooks/useTrackingAuth';
import { getTrackingErrorMessage } from '@/features/tracking/utils/tracking-error.util';
import { ApiError } from '@/types/api.types';

function formatMessageDate(isoDate: string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(isoDate));
}

type MessageBubbleProps = {
  direction: typeof SecureMessageApiDirection.INBOUND | typeof SecureMessageApiDirection.OUTBOUND;
  senderLabel: string;
  bodyText: string;
  sentAt: string;
};

function MessageBubble({ direction, senderLabel, bodyText, sentAt }: MessageBubbleProps) {
  const isOutbound = direction === SecureMessageApiDirection.OUTBOUND;

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isOutbound ? 'flex-end' : 'flex-start',
      }}
    >
      <Paper
        variant="outlined"
        sx={{
          maxWidth: '85%',
          px: 2,
          py: 1.5,
          bgcolor: isOutbound ? 'primary.50' : 'grey.50',
          borderColor: isOutbound ? 'primary.light' : 'grey.300',
        }}
      >
        <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
          {isOutbound ? 'Siz' : senderLabel}
        </Typography>
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {bodyText}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
          {formatMessageDate(sentAt)}
        </Typography>
      </Paper>
    </Box>
  );
}

export function TrackingMessagesPage() {
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const { clearCredentials } = useTrackingAuth();
  const messagesQuery = useTrackingMessagesQuery();
  const sendMutation = useSendTrackingMessageMutation();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SendSecureMessageBody>({
    resolver: zodResolver(sendSecureMessageBodySchema),
    defaultValues: { bodyText: '' },
  });

  useEffect(() => {
    if (
      messagesQuery.isError &&
      messagesQuery.error instanceof ApiError &&
      messagesQuery.error.status === 401
    ) {
      clearCredentials();
      void navigate('/tracking', {
        replace: true,
        state: { sessionExpired: true },
      });
    }
  }, [clearCredentials, messagesQuery.error, messagesQuery.isError, navigate]);

  useEffect(() => {
    if (messagesQuery.isSuccess) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messagesQuery.data, messagesQuery.isSuccess, sendMutation.isSuccess]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await sendMutation.mutateAsync(values.bodyText);
      reset({ bodyText: '' });
    } catch {
      // Toast handled via mutation error state below
    }
  });

  const isSending = isSubmitting || sendMutation.isPending;

  return (
    <Box
      sx={{
        maxWidth: 640,
        mx: 'auto',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '60vh',
      }}
    >
      <Stack spacing={2} sx={{ mb: 2 }}>
        <Typography variant="h4" component="h1" textAlign="center">
          Mesajlar
        </Typography>
        <Tabs
          value="messages"
          onChange={(_, value) => {
            if (value === 'status') {
              void navigate('/tracking/status');
            }
          }}
          variant="fullWidth"
          aria-label="Takip navigasyonu"
        >
          <Tab label="Durum" value="status" />
          <Tab label="Mesajlar" value="messages" aria-current="page" />
        </Tabs>
      </Stack>

      <Box sx={{ flex: 1, overflowY: 'auto', mb: 2, minHeight: 240 }}>
        {messagesQuery.isPending ? (
          <Stack spacing={2}>
            <Skeleton variant="rounded" height={72} sx={{ width: '70%', mr: 'auto' }} />
            <Skeleton variant="rounded" height={96} sx={{ width: '60%', ml: 'auto' }} />
            <Skeleton variant="rounded" height={64} sx={{ width: '75%', mr: 'auto' }} />
          </Stack>
        ) : null}

        {messagesQuery.isError ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={() => void messagesQuery.refetch()}>
                Tekrar Dene
              </Button>
            }
          >
            {getTrackingErrorMessage(messagesQuery.error, 'Mesajlar yüklenemedi.')}
          </Alert>
        ) : null}

        {messagesQuery.isSuccess && messagesQuery.data.length === 0 ? (
          <Stack
            spacing={1.5}
            alignItems="center"
            justifyContent="center"
            sx={{ py: 6, textAlign: 'center' }}
          >
            <ChatBubbleOutlineOutlinedIcon
              sx={{ fontSize: 48, color: 'text.disabled' }}
              aria-hidden
            />
            <Typography variant="body1" color="text.secondary">
              Henüz mesaj bulunmuyor. Kurul sekretaryası sizinle buradan iletişim kurabilir.
            </Typography>
          </Stack>
        ) : null}

        {messagesQuery.isSuccess && messagesQuery.data.length > 0 ? (
          <Stack spacing={2}>
            {messagesQuery.data.map((message) => (
              <MessageBubble
                key={message.id}
                direction={message.direction}
                senderLabel={message.senderLabel}
                bodyText={message.bodyText}
                sentAt={message.sentAt}
              />
            ))}
            <div ref={messagesEndRef} />
          </Stack>
        ) : null}
      </Box>

      {sendMutation.isError ? (
        <Alert severity="error" sx={{ mb: 2 }} role="alert">
          {getTrackingErrorMessage(sendMutation.error, 'Mesaj gönderilemedi. Tekrar deneyin.')}
        </Alert>
      ) : null}

      <Paper
        component="form"
        variant="outlined"
        onSubmit={(event) => {
          void onSubmit(event);
        }}
        sx={{
          position: 'sticky',
          bottom: 0,
          p: 2,
          bgcolor: 'background.paper',
        }}
      >
        <Stack spacing={1.5}>
          <Controller
            name="bodyText"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Mesajınız"
                multiline
                minRows={3}
                maxRows={8}
                fullWidth
                error={Boolean(errors.bodyText)}
                helperText={errors.bodyText?.message ?? `${String(field.value.length)}/5000`}
                slotProps={{
                  htmlInput: {
                    maxLength: 5000,
                    'aria-required': true,
                  },
                }}
                disabled={isSending || messagesQuery.isPending}
              />
            )}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="submit"
              variant="contained"
              endIcon={
                isSending ? <CircularProgress size={18} color="inherit" /> : <SendOutlinedIcon />
              }
              disabled={isSending || messagesQuery.isPending || messagesQuery.isError}
            >
              Gönder
            </Button>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}

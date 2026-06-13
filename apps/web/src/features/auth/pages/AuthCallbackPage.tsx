import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { ApiError } from '@/types/api.types';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [hasFailed, setHasFailed] = useState(false);
  const { isSuccess, isError, error } = useCurrentUser();

  useEffect(() => {
    if (isSuccess) {
      const returnUrl = searchParams.get('returnUrl');
      const destination = returnUrl && returnUrl.startsWith('/') ? returnUrl : '/app/dashboard';
      void navigate(destination, { replace: true });
    }
  }, [isSuccess, navigate, searchParams]);

  useEffect(() => {
    if (isError) {
      setHasFailed(true);
    }
  }, [isError]);

  if (hasFailed) {
    const message = error instanceof ApiError ? error.message : 'Giriş başarısız. Tekrar deneyin.';

    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 2,
        }}
      >
        <Stack spacing={2} alignItems="center" textAlign="center" maxWidth={420}>
          <ErrorOutlineOutlinedIcon color="error" sx={{ fontSize: 48 }} />
          <Typography variant="h5" component="h1">
            Giriş başarısız
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {message}
          </Typography>
          <Button variant="contained" href="/auth/login">
            Tekrar Dene
          </Button>
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Stack spacing={2} alignItems="center">
        <CircularProgress aria-label="Giriş yapılıyor" />
        <Typography variant="body1" color="text.secondary">
          Giriş yapılıyor...
        </Typography>
      </Stack>
    </Box>
  );
}

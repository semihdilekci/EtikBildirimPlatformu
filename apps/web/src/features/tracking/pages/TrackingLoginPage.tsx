import {
  Alert,
  Button,
  Card,
  CardContent,
  CircularProgress,
  IconButton,
  InputAdornment,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { zodResolver } from '@hookform/resolvers/zod';
import { trackingLoginSchema, type TrackingLoginValues } from '@ethics/dto';
import { ErrorCode } from '@ethics/shared';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link as RouterLink, useLocation } from 'react-router-dom';

import { FormPanel, PageHeader } from '@/components/brand';
import { useTrackingVerify } from '@/features/tracking/hooks/useTrackingVerify';
import {
  getTrackingErrorMessage,
  isTrackingRateLimitError,
} from '@/features/tracking/utils/tracking-error.util';
import { ApiError } from '@/types/api.types';

type LoginLocationState = {
  sessionExpired?: boolean;
};

export function TrackingLoginPage() {
  const location = useLocation();
  const verifyMutation = useTrackingVerify();
  const [showPassword, setShowPassword] = useState(false);
  const [sessionExpiredAlert, setSessionExpiredAlert] = useState(false);
  const [errorAlert, setErrorAlert] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TrackingLoginValues>({
    resolver: zodResolver(trackingLoginSchema),
    defaultValues: {
      trackingCode: '',
      trackingPassword: '',
    },
  });

  useEffect(() => {
    const state = location.state as LoginLocationState | null;
    if (state?.sessionExpired) {
      setSessionExpiredAlert(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const onSubmit = handleSubmit(async (values) => {
    setErrorAlert(null);
    setSessionExpiredAlert(false);

    try {
      await verifyMutation.mutateAsync({
        trackingCode: values.trackingCode,
        trackingPassword: values.trackingPassword,
      });
    } catch (error) {
      if (error instanceof ApiError && error.code === ErrorCode.AUTH_ACCOUNT_LOCKED) {
        setIsLocked(true);
      }

      setErrorAlert(getTrackingErrorMessage(error));
    }
  });

  const isLoading = isSubmitting || verifyMutation.isPending;
  const inputsDisabled = isLoading || isLocked;

  return (
    <FormPanel>
      <Stack spacing={3}>
        <PageHeader
          align="center"
          title="Bildirim Takip"
          subtitle="Bildiriminizi takip etmek için takip kodunuzu ve şifrenizi giriniz."
        />

        {sessionExpiredAlert ? (
          <Alert severity="warning" role="alert">
            Oturumunuz sona erdi, tekrar giriş yapın.
          </Alert>
        ) : null}

        {errorAlert ? (
          <Alert
            severity={
              isLocked || isTrackingRateLimitError(verifyMutation.error) ? 'warning' : 'error'
            }
            role="alert"
          >
            {errorAlert}
          </Alert>
        ) : null}

        <Card variant="outlined">
          <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
            <Stack
              component="form"
              spacing={2.5}
              onSubmit={(event) => {
                void onSubmit(event);
              }}
              noValidate
            >
              <Controller
                name="trackingCode"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Takip Kodu"
                    placeholder="ETK-XXXX-XXXX"
                    spellCheck={false}
                    slotProps={{ htmlInput: { 'aria-required': true, autoComplete: 'off' } }}
                    error={Boolean(errors.trackingCode)}
                    helperText={errors.trackingCode?.message}
                    disabled={inputsDisabled}
                    fullWidth
                  />
                )}
              />

              <Controller
                name="trackingPassword"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Takip Şifresi"
                    type={showPassword ? 'text' : 'password'}
                    slotProps={{
                      htmlInput: { 'aria-required': true, autoComplete: 'off' },
                      input: {
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                              onClick={() => {
                                setShowPassword((current) => !current);
                              }}
                              edge="end"
                              disabled={inputsDisabled}
                            >
                              {showPassword ? (
                                <VisibilityOffOutlinedIcon />
                              ) : (
                                <VisibilityOutlinedIcon />
                              )}
                            </IconButton>
                          </InputAdornment>
                        ),
                      },
                    }}
                    error={Boolean(errors.trackingPassword)}
                    helperText={errors.trackingPassword?.message}
                    disabled={inputsDisabled}
                    fullWidth
                  />
                )}
              />

              <Button
                type="submit"
                variant="contained"
                size="large"
                fullWidth
                disabled={inputsDisabled}
                startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : undefined}
              >
                {isLoading ? 'Doğrulanıyor…' : 'Giriş'}
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Typography variant="body2" color="text.secondary" textAlign="center">
          Yeni bildirim yapmak ister misiniz?{' '}
          <Link component={RouterLink} to="/report" underline="hover">
            Bildirim formuna git
          </Link>
        </Typography>
      </Stack>
    </FormPanel>
  );
}

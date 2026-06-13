import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { Alert, Stack, TextField, Typography } from '@mui/material';
import type { Control, FieldErrors } from 'react-hook-form';
import { Controller } from 'react-hook-form';

import type { ReportFormValues } from '@/features/intake/schemas/report-form.schema';

type TrackingPasswordSectionProps = {
  control: Control<ReportFormValues>;
  errors: FieldErrors<ReportFormValues>;
};

export function TrackingPasswordSection({ control, errors }: TrackingPasswordSectionProps) {
  return (
    <Stack spacing={2}>
      <Typography variant="h6" component="h2" gutterBottom>
        Takip Şifresi Oluşturma
      </Typography>

      <Alert severity="warning" icon={<LockOutlinedIcon />} role="alert">
        Bu şifreyi unutursanız bildiriminize tekrar erişemezsiniz. Lütfen güvenli bir yere not edin.
        Şifre kurtarma seçeneği yoktur.
      </Alert>

      <Controller
        name="trackingPassword"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            label="Takip şifresi"
            type="password"
            fullWidth
            slotProps={{ htmlInput: { 'aria-required': true, autoComplete: 'off' } }}
            error={Boolean(errors.trackingPassword)}
            helperText={
              errors.trackingPassword?.message ??
              'En az 8 karakter, bir harf ve bir rakam içermelidir.'
            }
          />
        )}
      />

      <Controller
        name="trackingPasswordConfirm"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            label="Takip şifresi (tekrar)"
            type="password"
            fullWidth
            slotProps={{ htmlInput: { 'aria-required': true, autoComplete: 'off' } }}
            error={Boolean(errors.trackingPasswordConfirm)}
            helperText={errors.trackingPasswordConfirm?.message}
          />
        )}
      />
    </Stack>
  );
}

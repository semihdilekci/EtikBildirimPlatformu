import {
  Alert,
  Box,
  Checkbox,
  FormControlLabel,
  FormHelperText,
  Paper,
  Skeleton,
  Typography,
} from '@mui/material';
import { useEffect } from 'react';
import type { Control, FieldErrors } from 'react-hook-form';
import { Controller } from 'react-hook-form';

import type { ReportFormValues } from '@/features/intake/schemas/report-form.schema';

function stripHtmlToText(html: string): string {
  if (typeof document === 'undefined') {
    return html.replace(/<[^>]+>/g, '');
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
}

type KvkkConsentCheckboxProps = {
  control: Control<ReportFormValues>;
  errors: FieldErrors<ReportFormValues>;
  bodyHtml: string | undefined;
  version: string | undefined;
  isLoading: boolean;
  onVersionChange: (version: string) => void;
};

export function KvkkConsentCheckbox({
  control,
  errors,
  bodyHtml,
  version,
  isLoading,
  onVersionChange,
}: KvkkConsentCheckboxProps) {
  useEffect(() => {
    if (version) {
      onVersionChange(version);
    }
  }, [onVersionChange, version]);

  return (
    <Box>
      <Typography variant="h6" component="h2" gutterBottom>
        Kişisel Verilerin Korunması
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Bildiriminize devam etmeden önce aşağıdaki aydınlatma metnini okuyunuz.
      </Typography>

      <Paper
        variant="outlined"
        sx={{
          p: 2,
          maxHeight: 280,
          overflowY: 'auto',
          mb: 2,
          bgcolor: 'background.paper',
        }}
        aria-label="KVKK aydınlatma metni"
      >
        {isLoading ? (
          <>
            <Skeleton height={28} />
            <Skeleton height={28} />
            <Skeleton height={28} width="80%" />
          </>
        ) : (
          <Typography variant="body2" component="div" sx={{ whiteSpace: 'pre-wrap' }}>
            {bodyHtml ? stripHtmlToText(bodyHtml) : 'KVKK metni yüklenemedi.'}
          </Typography>
        )}
      </Paper>

      <Controller
        name="kvkkConsent"
        control={control}
        render={({ field }) => (
          <FormControlLabel
            control={
              <Checkbox
                {...field}
                checked={field.value}
                slotProps={{ input: { 'aria-required': true } }}
              />
            }
            label="KVKK aydınlatma metnini okudum ve onaylıyorum."
          />
        )}
      />
      {errors.kvkkConsent ? (
        <FormHelperText error role="alert">
          {errors.kvkkConsent.message}
        </FormHelperText>
      ) : null}

      {version ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          Metin versiyonu: {version}
        </Alert>
      ) : null}
    </Box>
  );
}

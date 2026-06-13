import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import TrackChangesOutlinedIcon from '@mui/icons-material/TrackChangesOutlined';
import { Alert, Box, Button, Card, CardContent, Snackbar, Stack, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { Link as RouterLink, useLocation, useSearchParams } from 'react-router-dom';

import { FormPanel, PageHeader, Section } from '@/components/brand';
import { brandColors } from '@/styles/theme';

type SuccessLocationState = {
  trackingCode?: string;
  submittedAt?: string;
};

export function ReportSuccessPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [toastOpen, setToastOpen] = useState(false);

  const trackingCode = useMemo(() => {
    const state = location.state as SuccessLocationState | null;
    return state?.trackingCode ?? searchParams.get('code') ?? null;
  }, [location.state, searchParams]);

  const handleCopy = async () => {
    if (!trackingCode) {
      return;
    }

    try {
      await navigator.clipboard.writeText(trackingCode);
      setToastOpen(true);
    } catch {
      setToastOpen(false);
    }
  };

  if (!trackingCode) {
    return (
      <FormPanel maxWidth={480}>
        <Stack spacing={3} alignItems="center" textAlign="center">
          <PageHeader
            align="center"
            title="Bildiriminiz bulunamadı"
            subtitle="Yeni bildirim yapmak için aşağıdaki butonu kullanın."
          />
          <Button component={RouterLink} to="/report" variant="contained">
            Yeni Bildirim
          </Button>
        </Stack>
      </FormPanel>
    );
  }

  return (
    <FormPanel maxWidth={560}>
      <Stack spacing={3} alignItems="center">
        <CheckCircleOutlineIcon sx={{ fontSize: 56, color: 'success.main' }} aria-hidden />

        <PageHeader
          align="center"
          title="Bildiriminiz Alındı"
          subtitle="Takip kodunuzu güvenli bir yere kaydedin."
        />

        <Section variant="muted">
          <Box sx={{ width: '100%', p: 3 }}>
            <Card
              sx={{
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                border: 'none',
              }}
            >
              <CardContent>
                <Typography variant="overline" display="block" gutterBottom>
                  Takip Kodunuz
                </Typography>
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  spacing={2}
                >
                  <Typography variant="h5" component="p" fontFamily="monospace" aria-live="polite">
                    {trackingCode}
                  </Typography>
                  <Button
                    variant="contained"
                    color="inherit"
                    size="small"
                    startIcon={<ContentCopyIcon />}
                    onClick={() => void handleCopy()}
                    aria-label="Takip kodunu kopyala"
                    sx={{
                      bgcolor: 'common.white',
                      color: 'primary.main',
                      '&:hover': { bgcolor: brandColors.red.wash },
                    }}
                  >
                    Kopyala
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Box>
        </Section>

        <Alert severity="warning" sx={{ width: '100%' }}>
          Takip kodunuzu ve şifrenizi güvenli bir yere kaydedin. Şifre kurtarma seçeneği yoktur. Bu
          bilgileri kaybederseniz bildiriminize tekrar erişemezsiniz.
        </Alert>

        <Typography variant="body1" color="text.secondary" textAlign="center">
          Bildiriminiz kurul sekretaryası tarafından değerlendirilecektir. Takip ekranından
          durumunuzu kontrol edebilirsiniz.
        </Typography>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          justifyContent="center"
          sx={{ width: '100%' }}
        >
          <Button
            component={RouterLink}
            to="/tracking"
            variant="contained"
            startIcon={<TrackChangesOutlinedIcon />}
            fullWidth
            sx={{ maxWidth: { sm: 240 } }}
          >
            Takip Ekranına Git
          </Button>
          <Button
            component={RouterLink}
            to="/report"
            variant="outlined"
            color="primary"
            fullWidth
            sx={{ maxWidth: { sm: 240 } }}
          >
            Yeni Bildirim
          </Button>
        </Stack>
      </Stack>

      <Snackbar
        open={toastOpen}
        autoHideDuration={3000}
        onClose={() => {
          setToastOpen(false);
        }}
        message="Takip kodu panoya kopyalandı"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </FormPanel>
  );
}

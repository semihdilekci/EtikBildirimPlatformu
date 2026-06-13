import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import TrackChangesOutlinedIcon from '@mui/icons-material/TrackChangesOutlined';
import { Alert, Button, Card, CardContent, Snackbar, Stack, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { Link as RouterLink, useLocation, useSearchParams } from 'react-router-dom';

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
      <Stack spacing={3} alignItems="center" textAlign="center" sx={{ py: 4 }}>
        <Typography variant="h5" component="h1">
          Bildiriminiz bulunamadı
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Yeni bildirim yapmak için aşağıdaki butonu kullanın.
        </Typography>
        <Button component={RouterLink} to="/report" variant="contained">
          Yeni Bildirim
        </Button>
      </Stack>
    );
  }

  return (
    <Stack spacing={3} alignItems="center" sx={{ py: 2 }}>
      <CheckCircleOutlineIcon sx={{ fontSize: 64, color: 'success.main' }} aria-hidden />
      <Typography variant="h4" component="h1" textAlign="center">
        Bildiriminiz Alındı
      </Typography>

      <Card
        sx={{
          width: '100%',
          maxWidth: 480,
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
        }}
      >
        <CardContent>
          <Typography variant="overline" display="block" gutterBottom>
            Takip Kodunuz
          </Typography>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
            <Typography variant="h5" component="p" fontFamily="monospace" aria-live="polite">
              {trackingCode}
            </Typography>
            <Button
              variant="outlined"
              color="inherit"
              size="small"
              startIcon={<ContentCopyIcon />}
              onClick={() => void handleCopy()}
              aria-label="Takip kodunu kopyala"
            >
              Kopyala
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Alert severity="warning" sx={{ width: '100%', maxWidth: 560 }}>
        Takip kodunuzu ve şifrenizi güvenli bir yere kaydedin. Şifre kurtarma seçeneği yoktur. Bu
        bilgileri kaybederseniz bildiriminize tekrar erişemezsiniz.
      </Alert>

      <Typography variant="body1" color="text.secondary" textAlign="center" maxWidth={560}>
        Bildiriminiz kurul sekretaryası tarafından değerlendirilecektir. Takip ekranından durumunuzu
        kontrol edebilirsiniz.
      </Typography>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ width: '100%', maxWidth: 560 }}
      >
        <Button
          component={RouterLink}
          to="/tracking"
          variant="contained"
          fullWidth
          startIcon={<TrackChangesOutlinedIcon />}
        >
          Bildirim Takip Ekranına Git
        </Button>
        <Button component={RouterLink} to="/report" variant="outlined" fullWidth>
          Yeni Bildirim Yap
        </Button>
      </Stack>

      <Snackbar
        open={toastOpen}
        autoHideDuration={3000}
        onClose={() => {
          setToastOpen(false);
        }}
        message="Takip kodu kopyalandı"
      />
    </Stack>
  );
}

import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import { Box, Button, Card, CardContent, Container, Stack, Typography } from '@mui/material';
import { useSearchParams } from 'react-router-dom';

import { buildOidcLoginUrl } from '@/features/auth/api/auth.api';

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get('returnUrl') ?? undefined;

  const handleLogin = () => {
    window.location.assign(buildOidcLoginUrl(returnUrl));
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(160deg, #f4f6f9 0%, #e8edf5 100%)',
        px: 2,
      }}
    >
      <Container maxWidth="sm">
        <Card elevation={3}>
          <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
            <Stack spacing={3} alignItems="center" textAlign="center">
              <AccountBalanceOutlinedIcon sx={{ fontSize: 48, color: 'primary.main' }} />
              <Stack spacing={1}>
                <Typography variant="h4" component="h1">
                  Etik Bildirim Platformu
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Kurumsal hesabınızla giriş yaparak iç operasyon ekranlarına erişebilirsiniz.
                </Typography>
              </Stack>
              <Button
                variant="contained"
                size="large"
                fullWidth
                onClick={handleLogin}
                startIcon={<LoginOutlinedIcon />}
                sx={{ maxWidth: 360 }}
              >
                Kurumsal Hesapla Giriş Yap
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}

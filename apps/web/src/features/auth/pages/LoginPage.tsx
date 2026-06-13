import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import { Box, Button, Card, CardContent, Container, Stack } from '@mui/material';
import { useSearchParams } from 'react-router-dom';

import { PageHeader, YildizHoldingLogo } from '@/components/brand';
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
        bgcolor: 'background.default',
        px: 2,
        py: 4,
      }}
    >
      <Container maxWidth="sm">
        <Card variant="outlined">
          <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
            <Stack spacing={3} alignItems="center">
              <YildizHoldingLogo height={22} />
              <PageHeader
                align="center"
                dense
                title="Etik Bildirim Platformu"
                subtitle="Kurumsal hesabınızla giriş yaparak iç operasyon ekranlarına erişebilirsiniz."
              />
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

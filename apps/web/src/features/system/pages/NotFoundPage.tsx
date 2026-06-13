import { Box, Button, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        px: 2,
        textAlign: 'center',
      }}
    >
      <Typography variant="h4" component="h1">
        Sayfa bulunamadı
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Aradığınız sayfa mevcut değil veya taşınmış olabilir.
      </Typography>
      <Button component={RouterLink} to="/auth/login" variant="contained">
        Giriş sayfasına dön
      </Button>
    </Box>
  );
}

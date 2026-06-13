import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import { Box, Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

export function ForbiddenPage() {
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
      <Stack spacing={2} alignItems="center" maxWidth={480}>
        <BlockOutlinedIcon color="error" sx={{ fontSize: 48 }} />
        <Typography variant="h4" component="h1">
          Erişim reddedildi
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Bu sayfayı görüntülemek için gerekli role sahip değilsiniz.
        </Typography>
        <Button component={RouterLink} to="/app/dashboard" variant="contained">
          Gösterge paneline dön
        </Button>
      </Stack>
    </Box>
  );
}

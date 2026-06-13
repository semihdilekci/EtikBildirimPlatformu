import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import { Box, Paper, Stack, Typography } from '@mui/material';

import { useAuthStore } from '@/stores/useAuthStore';

export function DashboardPage() {
  const user = useAuthStore((state) => state.user);

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <DashboardOutlinedIcon color="primary" />
        <Typography variant="h5" component="h1">
          Gösterge Paneli
        </Typography>
      </Stack>

      <Paper sx={{ p: 3 }}>
        <Typography variant="body1" color="text.secondary" gutterBottom>
          Hoş geldiniz{user ? `, ${user.displayName}` : ''}.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Bu ekran Faz 1 iskelet placeholder&apos;ıdır. Vaka, görev ve bildirim modülleri sonraki
          fazlarda eklenecektir.
        </Typography>
      </Paper>

      <Box
        sx={{
          border: '1px dashed',
          borderColor: 'divider',
          borderRadius: 2,
          p: 4,
          textAlign: 'center',
          color: 'text.secondary',
        }}
      >
        <Typography variant="body2">Dashboard içeriği yakında burada görünecek.</Typography>
      </Box>
    </Stack>
  );
}

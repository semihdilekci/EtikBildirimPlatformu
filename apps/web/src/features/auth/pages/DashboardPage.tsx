import { Paper, Stack, Typography } from '@mui/material';

import { PageHeader } from '@/components/brand';
import { useAuthStore } from '@/stores/useAuthStore';

export function DashboardPage() {
  const user = useAuthStore((state) => state.user);

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Gösterge Paneli"
        subtitle={user ? `Hoş geldiniz, ${user.displayName}.` : 'Hoş geldiniz.'}
      />

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="body2" color="text.secondary">
          Bu ekran Faz 1 iskelet placeholder&apos;ıdır. Vaka, görev ve bildirim modülleri sonraki
          fazlarda eklenecektir.
        </Typography>
      </Paper>
    </Stack>
  );
}

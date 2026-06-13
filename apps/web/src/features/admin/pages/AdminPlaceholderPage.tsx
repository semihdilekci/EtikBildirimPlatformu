import { Paper, Stack, Typography } from '@mui/material';

interface AdminPlaceholderPageProps {
  title: string;
}

export function AdminPlaceholderPage({ title }: AdminPlaceholderPageProps) {
  return (
    <Stack spacing={3}>
      <Typography variant="h5" component="h1">
        {title}
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography variant="body2" color="text.secondary">
          Bu ekran Faz 9&apos;da implement edilecektir. Route ve rol koruması Faz 2 iskelet
          kapsamındadır.
        </Typography>
      </Paper>
    </Stack>
  );
}

import { Chip, Stack, Typography } from '@mui/material';
import type { ReportStatusCode } from '@ethics/shared';

import { TRACKING_STATUS_CONFIG } from '@/features/tracking/constants/status-config';

type StatusBadgeProps = {
  status: ReportStatusCode;
  label: string;
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const config = TRACKING_STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <Stack spacing={1.5} alignItems="center">
      <Chip
        icon={<Icon aria-hidden />}
        label={label}
        color={config.color}
        variant="outlined"
        size="medium"
        sx={{
          fontSize: '1rem',
          py: 2.5,
          px: 1,
          '& .MuiChip-icon': { fontSize: 28 },
        }}
        aria-label={`Bildirim durumu: ${label}`}
      />
      <Typography variant="body2" color="text.secondary" textAlign="center">
        {config.description}
      </Typography>
    </Stack>
  );
}

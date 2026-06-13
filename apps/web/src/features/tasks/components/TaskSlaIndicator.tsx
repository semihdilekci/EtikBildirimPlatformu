import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { Chip, Stack, Typography } from '@mui/material';
import type { TaskListItem } from '@ethics/dto';
import { TaskStatus } from '@ethics/shared';
import { useEffect, useState } from 'react';

import {
  formatSlaRemainingText,
  getSlaChipColor,
  getSlaStatusLabel,
  resolveSlaDisplayStatus,
  type SlaDisplayStatus,
} from '@/features/tasks/utils/task-sla.util';

type TaskSlaIndicatorProps = {
  dueAt: string | null;
  createdAt: string;
  slaStatus?: TaskListItem['slaStatus'];
  status: TaskListItem['status'];
  size?: 'small' | 'medium';
};

function getSlaIcon(status: SlaDisplayStatus | null) {
  switch (status) {
    case 'OVERDUE':
      return <ErrorOutlineOutlinedIcon fontSize="inherit" aria-hidden />;
    case 'WARNING':
      return <WarningAmberOutlinedIcon fontSize="inherit" aria-hidden />;
    case 'ON_TRACK':
      return <AccessTimeOutlinedIcon fontSize="inherit" aria-hidden />;
    default:
      return null;
  }
}

export function TaskSlaIndicator({
  dueAt,
  createdAt,
  slaStatus,
  status,
  size = 'small',
}: TaskSlaIndicatorProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!dueAt || status === TaskStatus.COMPLETED || status === TaskStatus.CANCELLED) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [dueAt, status]);

  if (
    !dueAt ||
    status === TaskStatus.COMPLETED ||
    status === TaskStatus.CANCELLED ||
    status === TaskStatus.DELEGATED
  ) {
    return (
      <Typography variant="body2" color="text.secondary">
        —
      </Typography>
    );
  }

  const displayStatus = resolveSlaDisplayStatus({ dueAt, createdAt, slaStatus }, nowMs);
  const remainingText = formatSlaRemainingText({ dueAt, createdAt, slaStatus }, nowMs);
  const chipColor = getSlaChipColor(displayStatus);
  const statusLabel = getSlaStatusLabel(displayStatus);
  const ariaLabel = remainingText ? `${statusLabel}: ${remainingText}` : statusLabel;

  if (size === 'medium') {
    return (
      <Stack spacing={0.5}>
        <Chip
          size="medium"
          color={chipColor}
          icon={getSlaIcon(displayStatus) ?? undefined}
          label={statusLabel}
          aria-label={ariaLabel}
        />
        {remainingText ? (
          <Typography variant="body2" color="text.secondary">
            {remainingText}
          </Typography>
        ) : null}
      </Stack>
    );
  }

  return (
    <Chip
      size="small"
      color={chipColor}
      icon={getSlaIcon(displayStatus) ?? undefined}
      label={remainingText ?? statusLabel}
      aria-label={ariaLabel}
    />
  );
}

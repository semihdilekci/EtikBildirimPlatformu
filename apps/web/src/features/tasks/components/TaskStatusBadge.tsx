import { Chip } from '@mui/material';
import type { TaskStatusCode } from '@ethics/shared';

import {
  getTaskStatusChipColor,
  getTaskStatusLabel,
} from '@/features/tasks/utils/task-format.util';

type TaskStatusBadgeProps = {
  status: TaskStatusCode;
};

export function TaskStatusBadge({ status }: TaskStatusBadgeProps) {
  return (
    <Chip
      size="small"
      color={getTaskStatusChipColor(status)}
      label={getTaskStatusLabel(status)}
      aria-label={`Görev durumu: ${getTaskStatusLabel(status)}`}
    />
  );
}

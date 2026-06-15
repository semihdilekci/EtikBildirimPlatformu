import { Chip } from '@mui/material';
import type { ApprovalWorkItemStatusCode } from '@ethics/shared';

import {
  getApprovalStatusChipColor,
  getApprovalStatusLabel,
} from '@/features/tasks/utils/approval-format.util';

type ApprovalStatusBadgeProps = {
  status: ApprovalWorkItemStatusCode;
};

export function ApprovalStatusBadge({ status }: ApprovalStatusBadgeProps) {
  const label = getApprovalStatusLabel(status);

  return (
    <Chip
      size="small"
      color={getApprovalStatusChipColor(status)}
      label={label}
      aria-label={`Onay durumu: ${label}`}
    />
  );
}

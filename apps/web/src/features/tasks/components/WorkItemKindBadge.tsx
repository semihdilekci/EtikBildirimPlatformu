import { Chip } from '@mui/material';
import { WorkItemKind, type WorkItemKindCode } from '@ethics/shared';

import { getWorkItemKindLabel } from '@/features/tasks/utils/approval-format.util';

type WorkItemKindBadgeProps = {
  kind: WorkItemKindCode;
};

export function WorkItemKindBadge({ kind }: WorkItemKindBadgeProps) {
  const label = getWorkItemKindLabel(kind);

  return (
    <Chip
      size="small"
      variant="outlined"
      color={kind === WorkItemKind.APPROVAL ? 'secondary' : 'default'}
      label={label}
      aria-label={`Görev türü: ${label}`}
    />
  );
}

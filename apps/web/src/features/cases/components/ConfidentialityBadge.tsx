import { Chip } from '@mui/material';
import type { ClearanceLevelCode } from '@ethics/shared';

import { getClearanceLabel } from '@/features/cases/constants/clearance-labels';

type ConfidentialityBadgeProps = {
  level: ClearanceLevelCode;
  size?: 'small' | 'medium';
};

function resolveColor(level: ClearanceLevelCode): 'default' | 'warning' | 'error' {
  switch (level) {
    case 'STRICTLY_CONFIDENTIAL':
      return 'error';
    case 'SENSITIVE':
      return 'warning';
    default:
      return 'default';
  }
}

export function ConfidentialityBadge({ level, size = 'small' }: ConfidentialityBadgeProps) {
  const label = getClearanceLabel(level);

  return (
    <Chip
      label={label}
      color={resolveColor(level)}
      variant="outlined"
      size={size}
      aria-label={`Gizlilik seviyesi: ${label}`}
    />
  );
}

import { Chip } from '@mui/material';
import type { CaseStateCode } from '@ethics/shared';

import { CASE_STATE_CONFIG } from '@/features/cases/constants/case-state-config';

type CaseStateBadgeProps = {
  state: CaseStateCode;
  label: string;
  size?: 'small' | 'medium';
};

export function CaseStateBadge({ state, label, size = 'small' }: CaseStateBadgeProps) {
  const config = CASE_STATE_CONFIG[state];
  const Icon = config.icon;

  return (
    <Chip
      icon={<Icon aria-hidden />}
      label={label}
      color={config.color}
      variant="outlined"
      size={size}
      aria-label={`Vaka durumu: ${label}`}
    />
  );
}

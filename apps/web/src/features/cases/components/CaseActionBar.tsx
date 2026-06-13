import { Button, Stack } from '@mui/material';
import { getWorkflowCommandLabel, type WorkflowCommandCode } from '@ethics/shared';

import { PermissionGate } from '@/features/auth/components/PermissionGate';
import { PermissionCode } from '@ethics/policy';

type CaseActionBarProps = {
  availableActions: WorkflowCommandCode[];
  disabled?: boolean;
  onActionClick: (command: WorkflowCommandCode) => void;
};

export function CaseActionBar({
  availableActions,
  disabled = false,
  onActionClick,
}: CaseActionBarProps) {
  if (availableActions.length === 0) {
    return null;
  }

  return (
    <PermissionGate permission={PermissionCode.CASE_TRANSITION}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {availableActions.map((command) => (
          <Button
            key={command}
            variant="contained"
            size="small"
            disabled={disabled}
            onClick={() => {
              onActionClick(command);
            }}
          >
            {getWorkflowCommandLabel(command)}
          </Button>
        ))}
      </Stack>
    </PermissionGate>
  );
}

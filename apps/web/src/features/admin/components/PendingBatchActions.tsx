import { Chip, Stack } from '@mui/material';
import { useState } from 'react';

import { PendingApprovalDialog } from '@/features/admin/components/PendingApprovalDialog';

type PendingBatchActionsProps = {
  batchId: string;
  isSubmitting: boolean;
  onApprove: (batchId: string, approved: boolean, reason: string) => Promise<void>;
};

export function PendingBatchActions({
  batchId,
  isSubmitting,
  onApprove,
}: PendingBatchActionsProps) {
  const [mode, setMode] = useState<'approve' | 'reject' | null>(null);

  const handleConfirm = async (approved: boolean, reason: string) => {
    await onApprove(batchId, approved, reason);
    setMode(null);
  };

  return (
    <>
      <Stack direction="row" spacing={1} alignItems="center">
        <Chip label="Onay Bekliyor" color="warning" size="small" />
        <Chip
          label="Onayla"
          color="primary"
          size="small"
          onClick={() => {
            setMode('approve');
          }}
          clickable
          disabled={isSubmitting}
        />
        <Chip
          label="Reddet"
          color="error"
          size="small"
          variant="outlined"
          onClick={() => {
            setMode('reject');
          }}
          clickable
          disabled={isSubmitting}
        />
      </Stack>
      <PendingApprovalDialog
        open={mode !== null}
        summary="Bekleyen yapılandırma değişikliğini onaylayın veya reddedin."
        mode={mode}
        isSubmitting={isSubmitting}
        onClose={() => {
          setMode(null);
        }}
        onConfirm={handleConfirm}
      />
    </>
  );
}

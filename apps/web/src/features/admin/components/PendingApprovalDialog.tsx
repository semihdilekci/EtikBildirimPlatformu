import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
} from '@mui/material';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Controller, useForm } from 'react-hook-form';

const approvalFormSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

type ApprovalFormValues = z.infer<typeof approvalFormSchema>;

type PendingApprovalDialogProps = {
  open: boolean;
  summary: string;
  mode: 'approve' | 'reject' | null;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (approved: boolean, reason: string) => Promise<void>;
};

export function PendingApprovalDialog({
  open,
  summary,
  mode,
  isSubmitting,
  onClose,
  onConfirm,
}: PendingApprovalDialogProps) {
  const form = useForm<ApprovalFormValues>({
    resolver: zodResolver(approvalFormSchema),
    defaultValues: { reason: '' },
  });

  const handleClose = () => {
    if (isSubmitting) {
      return;
    }
    form.reset({ reason: '' });
    onClose();
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    if (!mode) {
      return;
    }
    await onConfirm(mode === 'approve', values.reason);
    form.reset({ reason: '' });
  });

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="pending-approval-title"
    >
      <DialogTitle id="pending-approval-title">
        {mode === 'approve' ? 'Onayla' : 'Reddet'}
      </DialogTitle>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>{summary}</DialogContentText>
          <Controller
            name="reason"
            control={form.control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Gerekçe"
                required
                multiline
                minRows={3}
                fullWidth
                error={Boolean(fieldState.error)}
                helperText={fieldState.error?.message ?? 'En az 3 karakter'}
              />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={isSubmitting}>
            İptal
          </Button>
          <Button
            type="submit"
            color={mode === 'reject' ? 'error' : 'primary'}
            variant="contained"
            disabled={isSubmitting || !mode}
          >
            {isSubmitting ? (
              <CircularProgress size={20} />
            ) : mode === 'approve' ? (
              'Onayla'
            ) : (
              'Reddet'
            )}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

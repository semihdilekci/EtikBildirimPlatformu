import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import { zodResolver } from '@hookform/resolvers/zod';
import { decideTaskBodySchema, type DecideTaskBody } from '@ethics/dto';
import { Controller, useForm } from 'react-hook-form';
import { useEffect } from 'react';

type ApprovalDecideDialogProps = {
  open: boolean;
  mode: 'approve' | 'reject';
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (body: DecideTaskBody) => Promise<void>;
};

export function ApprovalDecideDialog({
  open,
  mode,
  isSubmitting,
  onClose,
  onConfirm,
}: ApprovalDecideDialogProps) {
  const form = useForm<DecideTaskBody>({
    resolver: zodResolver(decideTaskBodySchema),
    defaultValues: {
      approved: mode === 'approve',
      reason: '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        approved: mode === 'approve',
        reason: '',
      });
    }
  }, [form, mode, open]);

  const handleClose = () => {
    if (isSubmitting) {
      return;
    }
    form.reset({
      approved: mode === 'approve',
      reason: '',
    });
    onClose();
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    await onConfirm({
      approved: mode === 'approve',
      reason: values.reason.trim(),
    });
    form.reset({
      approved: mode === 'approve',
      reason: '',
    });
  });

  const title = mode === 'approve' ? 'Onayı Onayla' : 'Talebi Reddet';
  const confirmLabel = mode === 'approve' ? 'Onayla' : 'Reddet';
  const reasonLabel = mode === 'approve' ? 'Onay gerekçesi' : 'Red gerekçesi';

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="approval-decide-title"
    >
      <DialogTitle id="approval-decide-title">{title}</DialogTitle>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <DialogContent>
          <Controller
            name="reason"
            control={form.control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label={reasonLabel}
                multiline
                minRows={3}
                fullWidth
                required
                error={Boolean(fieldState.error)}
                helperText={fieldState.error?.message ?? 'En az 3 karakter girin.'}
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
            variant="contained"
            color={mode === 'reject' ? 'error' : 'primary'}
            disabled={isSubmitting}
          >
            {isSubmitting ? <CircularProgress size={20} aria-label="Gönderiliyor" /> : confirmLabel}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

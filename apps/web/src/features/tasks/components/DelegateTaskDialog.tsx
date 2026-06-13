import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { zodResolver } from '@hookform/resolvers/zod';
import { delegateTaskBodySchema, type DelegateTaskBody } from '@ethics/dto';
import { Controller, useForm } from 'react-hook-form';

type DelegateFormValues = DelegateTaskBody;

type DelegateTaskDialogProps = {
  open: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (body: DelegateTaskBody) => Promise<void>;
};

export function DelegateTaskDialog({
  open,
  isSubmitting,
  onClose,
  onConfirm,
}: DelegateTaskDialogProps) {
  const form = useForm<DelegateFormValues>({
    resolver: zodResolver(delegateTaskBodySchema),
    defaultValues: {
      delegateToUserId: '',
      reason: '',
    },
  });

  const handleClose = () => {
    if (isSubmitting) {
      return;
    }
    form.reset();
    onClose();
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    await onConfirm({
      delegateToUserId: values.delegateToUserId.trim(),
      reason: values.reason.trim(),
    });
    form.reset();
  });

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="delegate-task-title"
    >
      <DialogTitle id="delegate-task-title">Görevi Devret</DialogTitle>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <DialogContent>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Devredilecek kullanıcı, görevin atandığı role sahip aktif bir iç kullanıcı olmalıdır.
            </Typography>
            <Controller
              name="delegateToUserId"
              control={form.control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Devredilecek kullanıcı ID"
                  fullWidth
                  required
                  error={Boolean(fieldState.error)}
                  helperText={
                    fieldState.error?.message ?? 'Aynı role sahip kullanıcının sistem ID değeri'
                  }
                />
              )}
            />
            <Controller
              name="reason"
              control={form.control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Devir gerekçesi"
                  multiline
                  minRows={3}
                  fullWidth
                  required
                  error={Boolean(fieldState.error)}
                  helperText={fieldState.error?.message}
                />
              )}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={isSubmitting}>
            İptal
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? <CircularProgress size={20} aria-label="Devrediliyor" /> : 'Devret'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

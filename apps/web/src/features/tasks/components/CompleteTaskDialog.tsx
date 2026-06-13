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
import { completeTaskBodySchema, type CompleteTaskBody } from '@ethics/dto';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

const completeFormSchema = completeTaskBodySchema.extend({
  outcome: z.string().max(4000).optional(),
});

type CompleteFormValues = z.infer<typeof completeFormSchema>;

type CompleteTaskDialogProps = {
  open: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (body: CompleteTaskBody) => Promise<void>;
};

export function CompleteTaskDialog({
  open,
  isSubmitting,
  onClose,
  onConfirm,
}: CompleteTaskDialogProps) {
  const form = useForm<CompleteFormValues>({
    resolver: zodResolver(completeFormSchema),
    defaultValues: {
      outcome: '',
      idempotencyKey: crypto.randomUUID(),
    },
  });

  const handleClose = () => {
    if (isSubmitting) {
      return;
    }
    form.reset({
      outcome: '',
      idempotencyKey: crypto.randomUUID(),
    });
    onClose();
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    const trimmedOutcome = values.outcome?.trim();
    await onConfirm({
      idempotencyKey: values.idempotencyKey,
      outcome: trimmedOutcome && trimmedOutcome.length > 0 ? trimmedOutcome : undefined,
    });
    form.reset({
      outcome: '',
      idempotencyKey: crypto.randomUUID(),
    });
  });

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="complete-task-title"
    >
      <DialogTitle id="complete-task-title">Görevi Tamamla</DialogTitle>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <DialogContent>
          <Controller
            name="outcome"
            control={form.control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Sonuç notu (opsiyonel)"
                multiline
                minRows={3}
                fullWidth
                error={Boolean(fieldState.error)}
                helperText={fieldState.error?.message}
              />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={isSubmitting}>
            İptal
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? <CircularProgress size={20} aria-label="Tamamlanıyor" /> : 'Tamamla'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

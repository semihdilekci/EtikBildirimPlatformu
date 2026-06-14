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
import { useEffect } from 'react';

const reasonFormSchema = z.object({
  reason: z.string().trim().min(3, 'En az 3 karakter').max(500),
});

type ReasonFormValues = z.infer<typeof reasonFormSchema>;

type AdminReasonDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
};

export function AdminReasonDialog({
  open,
  title,
  description,
  confirmLabel = 'Kaydet',
  isSubmitting,
  onClose,
  onConfirm,
}: AdminReasonDialogProps) {
  const form = useForm<ReasonFormValues>({
    resolver: zodResolver(reasonFormSchema),
    defaultValues: { reason: '' },
  });

  useEffect(() => {
    if (!open) {
      form.reset({ reason: '' });
    }
  }, [open, form]);

  const handleClose = () => {
    if (isSubmitting) {
      return;
    }
    form.reset({ reason: '' });
    onClose();
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    await onConfirm(values.reason);
    form.reset({ reason: '' });
  });

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="admin-reason-dialog-title"
    >
      <DialogTitle id="admin-reason-dialog-title">{title}</DialogTitle>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <DialogContent>
          {description ? <DialogContentText sx={{ mb: 2 }}>{description}</DialogContentText> : null}
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
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? <CircularProgress size={20} /> : confirmLabel}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

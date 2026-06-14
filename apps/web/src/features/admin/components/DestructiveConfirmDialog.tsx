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

const destructiveConfirmSchema = z.object({
  confirmText: z
    .string()
    .trim()
    .refine((value) => value === 'ONAYLIYORUM', { message: 'ONAYLIYORUM yazın' }),
  reason: z.string().trim().min(3, 'En az 3 karakter').max(500),
});

type DestructiveConfirmFormValues = {
  confirmText: string;
  reason: string;
};

type DestructiveConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
};

export function DestructiveConfirmDialog({
  open,
  title,
  description,
  isSubmitting,
  onClose,
  onConfirm,
}: DestructiveConfirmDialogProps) {
  const form = useForm<DestructiveConfirmFormValues>({
    resolver: zodResolver(destructiveConfirmSchema),
    defaultValues: { confirmText: '', reason: '' },
  });

  useEffect(() => {
    if (!open) {
      form.reset({ confirmText: '', reason: '' });
    }
  }, [open, form]);

  const handleClose = () => {
    if (isSubmitting) {
      return;
    }
    form.reset({ confirmText: '', reason: '' });
    onClose();
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    await onConfirm(values.reason);
    form.reset({ confirmText: '', reason: '' });
  });

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="destructive-confirm-title"
    >
      <DialogTitle id="destructive-confirm-title" color="error">
        {title}
      </DialogTitle>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>{description}</DialogContentText>
          <DialogContentText sx={{ mb: 2, fontWeight: 600 }}>
            Onaylamak için aşağıya ONAYLIYORUM yazın.
          </DialogContentText>
          <Controller
            name="confirmText"
            control={form.control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Onay metni"
                required
                fullWidth
                sx={{ mb: 2 }}
                error={Boolean(fieldState.error)}
                helperText={fieldState.error?.message ?? 'ONAYLIYORUM yazın'}
              />
            )}
          />
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
          <Button type="submit" color="error" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? <CircularProgress size={20} /> : 'Yayınla'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

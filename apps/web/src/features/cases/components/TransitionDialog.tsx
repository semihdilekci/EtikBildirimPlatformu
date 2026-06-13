import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  TextField,
} from '@mui/material';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  REASON_REQUIRED_COMMANDS,
  WorkflowCommand,
  getWorkflowCommandLabel,
  type WorkflowCommandCode,
} from '@ethics/shared';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { TRANSITION_METADATA_FIELDS } from '@/features/cases/constants/transition-metadata-fields';

const transitionFormSchema = z
  .object({
    command: z.custom<WorkflowCommandCode>((value) => typeof value === 'string'),
    reason: z.string().max(2000).optional(),
    metadataFields: z.record(z.union([z.string(), z.boolean()])),
  })
  .superRefine((value, ctx) => {
    if (REASON_REQUIRED_COMMANDS.has(value.command) && !value.reason?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Bu işlem için gerekçe zorunludur.',
        path: ['reason'],
      });
    }

    const metadataFieldDefs = TRANSITION_METADATA_FIELDS[value.command];
    if (!metadataFieldDefs) {
      return;
    }

    for (const field of metadataFieldDefs) {
      const fieldValue = value.metadataFields[field.key];
      if (field.type === 'boolean') {
        if (fieldValue !== true) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${field.label} zorunludur.`,
            path: ['metadataFields', field.key],
          });
        }
        continue;
      }

      if (typeof fieldValue !== 'string' || fieldValue.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${field.label} zorunludur.`,
          path: ['metadataFields', field.key],
        });
      }
    }
  });

type TransitionFormValues = z.infer<typeof transitionFormSchema>;

type TransitionDialogProps = {
  open: boolean;
  command: WorkflowCommandCode | null;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    command: WorkflowCommandCode;
    reason?: string;
    idempotencyKey: string;
    metadata: Record<string, unknown>;
  }) => void;
};

export function TransitionDialog({
  open,
  command,
  isSubmitting,
  onClose,
  onConfirm,
}: TransitionDialogProps) {
  const form = useForm<TransitionFormValues>({
    resolver: zodResolver(transitionFormSchema),
    defaultValues: {
      command: WorkflowCommand.ACKNOWLEDGE_REPORT,
      reason: '',
      metadataFields: {},
    },
  });

  useEffect(() => {
    if (open && command) {
      form.reset({
        command,
        reason: '',
        metadataFields: {},
      });
    }
  }, [command, form, open]);

  if (!command) {
    return null;
  }

  const metadataFields = TRANSITION_METADATA_FIELDS[command] ?? [];
  const requiresReason = REASON_REQUIRED_COMMANDS.has(command);

  const handleSubmit = form.handleSubmit((values) => {
    const metadata: Record<string, unknown> = { ...values.metadataFields };
    onConfirm({
      command: values.command,
      reason: values.reason?.trim() || undefined,
      idempotencyKey: crypto.randomUUID(),
      metadata,
    });
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="transition-dialog-title"
    >
      <DialogTitle id="transition-dialog-title">{getWorkflowCommandLabel(command)}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Alert severity="info">
            Bu işlem onaylandığında vaka durumu güncellenecektir. İşlem geri alınamaz.
          </Alert>

          <TextField
            label={requiresReason ? 'Gerekçe' : 'Gerekçe (isteğe bağlı)'}
            multiline
            minRows={3}
            required={requiresReason}
            fullWidth
            error={Boolean(form.formState.errors.reason)}
            helperText={form.formState.errors.reason?.message}
            {...form.register('reason')}
          />

          {metadataFields.map((field) => (
            <Controller
              key={field.key}
              control={form.control}
              name={`metadataFields.${field.key}`}
              render={({ field: controllerField, fieldState }) =>
                field.type === 'boolean' ? (
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={controllerField.value === true}
                        onChange={(event) => {
                          controllerField.onChange(event.target.checked);
                        }}
                      />
                    }
                    label={field.label}
                  />
                ) : (
                  <TextField
                    label={field.label}
                    helperText={fieldState.error?.message ?? field.helperText}
                    error={Boolean(fieldState.error)}
                    fullWidth
                    value={typeof controllerField.value === 'string' ? controllerField.value : ''}
                    onChange={controllerField.onChange}
                  />
                )
              }
            />
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSubmitting}>
          İptal
        </Button>
        <Button variant="contained" onClick={() => void handleSubmit()} disabled={isSubmitting}>
          Onayla
        </Button>
      </DialogActions>
    </Dialog>
  );
}

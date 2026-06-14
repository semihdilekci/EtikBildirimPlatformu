import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from '@mui/material';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateAdminUserClearanceBodySchema, type UpdateAdminUserClearanceBody } from '@ethics/dto';
import { CLEARANCE_LEVEL_VALUES, type ClearanceLevelCode } from '@ethics/shared';
import { Controller, useForm } from 'react-hook-form';

import { getClearanceLabel } from '@/features/cases/constants/clearance-labels';

type ClearanceUpdateDialogProps = {
  open: boolean;
  currentLevel: ClearanceLevelCode;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (body: UpdateAdminUserClearanceBody) => Promise<void>;
};

export function ClearanceUpdateDialog({
  open,
  currentLevel,
  isSubmitting,
  onClose,
  onConfirm,
}: ClearanceUpdateDialogProps) {
  const form = useForm<UpdateAdminUserClearanceBody>({
    resolver: zodResolver(updateAdminUserClearanceBodySchema),
    defaultValues: {
      clearanceLevel: currentLevel,
      reason: '',
    },
  });

  const handleClose = () => {
    if (isSubmitting) {
      return;
    }
    form.reset({ clearanceLevel: currentLevel, reason: '' });
    onClose();
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    await onConfirm(values);
    form.reset({ clearanceLevel: currentLevel, reason: '' });
  });

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="clearance-update-title"
    >
      <DialogTitle id="clearance-update-title">Yetki Seviyesi Değiştir</DialogTitle>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Controller
            name="clearanceLevel"
            control={form.control}
            render={({ field }) => (
              <FormControl fullWidth>
                <InputLabel id="clearance-level-label">Yetki Seviyesi</InputLabel>
                <Select {...field} labelId="clearance-level-label" label="Yetki Seviyesi">
                  {CLEARANCE_LEVEL_VALUES.map((level) => (
                    <MenuItem key={level} value={level}>
                      {getClearanceLabel(level)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
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
            {isSubmitting ? <CircularProgress size={20} /> : 'Kaydet'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

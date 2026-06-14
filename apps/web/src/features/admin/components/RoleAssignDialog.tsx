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
import { assignAdminUserRoleBodySchema, type AssignAdminUserRoleBody } from '@ethics/dto';
import { Controller, useForm } from 'react-hook-form';

import { ASSIGNABLE_ROLE_OPTIONS } from '@/features/admin/constants/role-labels';

type RoleAssignDialogProps = {
  open: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (body: AssignAdminUserRoleBody) => Promise<void>;
};

export function RoleAssignDialog({
  open,
  isSubmitting,
  onClose,
  onConfirm,
}: RoleAssignDialogProps) {
  const form = useForm<AssignAdminUserRoleBody>({
    resolver: zodResolver(assignAdminUserRoleBodySchema),
    defaultValues: {
      roleCode: 'action_owner',
      reason: '',
    },
  });

  const handleClose = () => {
    if (isSubmitting) {
      return;
    }
    form.reset({ roleCode: 'action_owner', reason: '' });
    onClose();
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    await onConfirm(values);
    form.reset({ roleCode: 'action_owner', reason: '' });
  });

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="role-assign-title"
    >
      <DialogTitle id="role-assign-title">Rol Ata</DialogTitle>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Controller
            name="roleCode"
            control={form.control}
            render={({ field }) => (
              <FormControl fullWidth>
                <InputLabel id="role-assign-code-label">Rol</InputLabel>
                <Select {...field} labelId="role-assign-code-label" label="Rol">
                  {ASSIGNABLE_ROLE_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
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
            {isSubmitting ? <CircularProgress size={20} /> : 'Ata'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

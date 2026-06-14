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
import { revokeAdminUserRoleBodySchema, type RevokeAdminUserRoleBody } from '@ethics/dto';
import type { Role as RoleCode } from '@ethics/shared';
import { Controller, useForm } from 'react-hook-form';

import { getRoleLabel } from '@/features/admin/constants/role-labels';

type RevokeRoleDialogProps = {
  open: boolean;
  roleCode: RoleCode | null;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (body: RevokeAdminUserRoleBody) => Promise<void>;
};

export function RevokeRoleDialog({
  open,
  roleCode,
  isSubmitting,
  onClose,
  onConfirm,
}: RevokeRoleDialogProps) {
  const form = useForm<RevokeAdminUserRoleBody>({
    resolver: zodResolver(revokeAdminUserRoleBodySchema),
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
    await onConfirm(values);
    form.reset({ reason: '' });
  });

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="revoke-role-title"
    >
      <DialogTitle id="revoke-role-title">Rol Kaldır</DialogTitle>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {roleCode
              ? `${getRoleLabel(roleCode)} rolünü kaldırmak üzeresiniz. Bu işlem geri alınamaz.`
              : 'Seçili rol kaldırılacak.'}
          </DialogContentText>
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
            {isSubmitting ? <CircularProgress size={20} /> : 'Kaldır'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

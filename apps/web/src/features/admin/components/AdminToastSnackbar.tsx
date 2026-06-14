import { Snackbar } from '@mui/material';

type AdminToastSeverity = 'success' | 'error' | 'info';

type AdminToastSnackbarProps = {
  message: string | null;
  severity: AdminToastSeverity;
  onClose: () => void;
};

export function AdminToastSnackbar({ message, severity, onClose }: AdminToastSnackbarProps) {
  return (
    <Snackbar
      open={Boolean(message)}
      autoHideDuration={5000}
      onClose={onClose}
      message={message ?? ''}
      slotProps={{
        content: {
          role: severity === 'error' ? 'alert' : 'status',
          sx: {
            bgcolor:
              severity === 'error'
                ? 'error.main'
                : severity === 'info'
                  ? 'info.main'
                  : 'success.main',
            color: 'common.white',
          },
        },
      }}
    />
  );
}

export type { AdminToastSeverity };

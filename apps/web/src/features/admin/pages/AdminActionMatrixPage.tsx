import {
  Alert,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type { ActionMatrixListItem } from '@ethics/dto';
import { ROLE_VALUES, type Role as RoleCode } from '@ethics/shared';
import { useEffect, useMemo, useState } from 'react';

import { AdminPageHeader } from '@/features/admin/components/AdminPageHeader';
import { AdminReasonDialog } from '@/features/admin/components/AdminReasonDialog';
import {
  AdminToastSnackbar,
  type AdminToastSeverity,
} from '@/features/admin/components/AdminToastSnackbar';
import { PendingBatchActions } from '@/features/admin/components/PendingBatchActions';
import {
  getActionMatrixLabel,
  getCheckerRoleOptions,
  isSameMakerCheckerRole,
} from '@/features/admin/constants/action-matrix-labels';
import { getRoleLabel } from '@/features/admin/constants/role-labels';
import {
  useActionMatrixQuery,
  useApproveActionMatrixBatchMutation,
  useUpdateActionMatrixMutation,
} from '@/features/admin/hooks/useAdminConfig';
import { useBeforeUnloadDirty } from '@/features/admin/hooks/useBeforeUnloadDirty';
import { getAdminErrorMessage } from '@/features/admin/utils/admin-error.util';
import { formatCaseDateTime } from '@/features/cases/utils/case-format.util';

type EditedRow = {
  original: ActionMatrixListItem;
  makerRole: RoleCode;
  checkerRole: RoleCode;
};

type ToastSeverity = AdminToastSeverity;

export function AdminActionMatrixPage() {
  const matrixQuery = useActionMatrixQuery();
  const updateMutation = useUpdateActionMatrixMutation();
  const approveMutation = useApproveActionMatrixBatchMutation();

  const [editedRows, setEditedRows] = useState<Record<string, EditedRow>>({});
  const [showReasonDialog, setShowReasonDialog] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastSeverity, setToastSeverity] = useState<ToastSeverity>('success');

  const isDirty = Object.keys(editedRows).length > 0;
  useBeforeUnloadDirty(isDirty);

  useEffect(() => {
    if (!matrixQuery.data) {
      return;
    }
    setEditedRows({});
  }, [matrixQuery.data]);

  const pendingBatchIds = useMemo(() => {
    const ids = new Set<string>();
    for (const row of matrixQuery.data ?? []) {
      if (row.pendingBatchId) {
        ids.add(row.pendingBatchId);
      }
    }
    return [...ids];
  }, [matrixQuery.data]);

  const showToast = (message: string, severity: ToastSeverity) => {
    setToastMessage(message);
    setToastSeverity(severity);
  };

  const updateRow = (
    row: ActionMatrixListItem,
    patch: Partial<Pick<EditedRow, 'makerRole' | 'checkerRole'>>,
  ) => {
    const current = editedRows[row.actionCode] ?? {
      original: row,
      makerRole: row.makerRole as RoleCode,
      checkerRole: row.checkerRole as RoleCode,
    };
    const nextMakerRole = patch.makerRole ?? current.makerRole;
    let nextCheckerRole = patch.checkerRole ?? current.checkerRole;

    if (patch.makerRole && nextMakerRole === nextCheckerRole) {
      const fallbackChecker = getCheckerRoleOptions(nextMakerRole)[0];
      if (fallbackChecker) {
        nextCheckerRole = fallbackChecker;
      }
    }

    const next: EditedRow = {
      ...current,
      makerRole: nextMakerRole,
      checkerRole: nextCheckerRole,
    };

    if (next.makerRole === row.makerRole && next.checkerRole === row.checkerRole) {
      setEditedRows((prev) => {
        const { [row.actionCode]: _removed, ...rest } = prev;
        return rest;
      });
      return;
    }

    setEditedRows((prev) => ({ ...prev, [row.actionCode]: next }));
  };

  const handleSaveAll = async (reason: string) => {
    const rows = Object.values(editedRows);
    try {
      for (const row of rows) {
        await updateMutation.mutateAsync({
          actionId: row.original.actionCode,
          body: {
            makerRole: row.makerRole,
            checkerRole: row.checkerRole,
            reason,
          },
        });
      }
      setShowReasonDialog(false);
      setEditedRows({});
      showToast('Matris değişiklikleri onay için gönderildi.', 'info');
    } catch (error) {
      showToast(getAdminErrorMessage(error), 'error');
    }
  };

  const handleApproveBatch = async (batchId: string, approved: boolean, reason: string) => {
    try {
      await approveMutation.mutateAsync({ batchId, body: { approved, reason } });
      showToast(
        approved ? 'Değişiklik onaylandı.' : 'Değişiklik reddedildi.',
        approved ? 'success' : 'info',
      );
    } catch (error) {
      showToast(getAdminErrorMessage(error), 'error');
    }
  };

  if (matrixQuery.isLoading) {
    return (
      <Stack spacing={3}>
        <Skeleton variant="text" width={360} height={40} />
        <Skeleton variant="rounded" height={420} />
      </Stack>
    );
  }

  if (matrixQuery.isError || !matrixQuery.data) {
    return (
      <Stack spacing={2}>
        <AdminPageHeader
          title="Maker-Checker Aksiyon Matrisi"
          description="Kritik işlemler için talep eden ve onaylayan rolleri yönetin."
        />
        <Alert severity="error">{getAdminErrorMessage(matrixQuery.error)}</Alert>
        <Button onClick={() => void matrixQuery.refetch()}>Tekrar Dene</Button>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <AdminPageHeader
        title="Maker-Checker Aksiyon Matrisi"
        description="Kritik işlemler için talep eden ve onaylayan rolleri yönetin."
      />

      <Typography variant="body2" color="text.secondary">
        Maker ve checker aynı rol olamaz.
      </Typography>

      {pendingBatchIds.map((batchId) => (
        <PendingBatchActions
          key={batchId}
          batchId={batchId}
          isSubmitting={approveMutation.isPending}
          onApprove={handleApproveBatch}
        />
      ))}

      <TableContainer component={Paper}>
        <Table size="small" aria-label="Aksiyon matrisi">
          <TableHead>
            <TableRow>
              <TableCell scope="col">Aksiyon</TableCell>
              <TableCell scope="col">Maker Rolü</TableCell>
              <TableCell scope="col">Checker Rolü</TableCell>
              <TableCell scope="col">Son Güncelleme</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {matrixQuery.data.map((row) => {
              const edited = editedRows[row.actionCode];
              const makerRole = (edited?.makerRole ?? row.makerRole) as RoleCode;
              const checkerRole = (edited?.checkerRole ?? row.checkerRole) as RoleCode;
              const checkerOptions = getCheckerRoleOptions(makerRole);
              const sameRoleWarning = isSameMakerCheckerRole(makerRole, checkerRole);

              return (
                <TableRow
                  key={row.actionCode}
                  sx={{ bgcolor: edited ? 'warning.light' : undefined }}
                >
                  <TableCell>
                    <Typography variant="body2">{getActionMatrixLabel(row.actionCode)}</Typography>
                    {sameRoleWarning ? (
                      <Typography variant="caption" color="error">
                        Aynı rol hem talep eden hem onaylayan olamaz
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <FormControl fullWidth size="small">
                      <InputLabel id={`maker-${row.actionCode}`}>Maker</InputLabel>
                      <Select
                        labelId={`maker-${row.actionCode}`}
                        label="Maker"
                        value={makerRole}
                        onChange={(event) => {
                          updateRow(row, { makerRole: event.target.value as RoleCode });
                        }}
                        disabled={Boolean(row.pendingBatchId)}
                      >
                        {ROLE_VALUES.map((role) => (
                          <MenuItem key={role} value={role}>
                            {getRoleLabel(role)}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </TableCell>
                  <TableCell>
                    <FormControl fullWidth size="small">
                      <InputLabel id={`checker-${row.actionCode}`}>Checker</InputLabel>
                      <Select
                        labelId={`checker-${row.actionCode}`}
                        label="Checker"
                        value={checkerRole}
                        onChange={(event) => {
                          updateRow(row, { checkerRole: event.target.value as RoleCode });
                        }}
                        disabled={Boolean(row.pendingBatchId)}
                      >
                        {checkerOptions.map((role) => (
                          <MenuItem key={role} value={role}>
                            {getRoleLabel(role)}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </TableCell>
                  <TableCell>{formatCaseDateTime(row.updatedAt)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Stack direction="row" spacing={2}>
        <Button
          variant="contained"
          disabled={!isDirty || updateMutation.isPending}
          onClick={() => {
            setShowReasonDialog(true);
          }}
        >
          Kaydet
        </Button>
        <Button
          variant="outlined"
          disabled={!isDirty || updateMutation.isPending}
          onClick={() => {
            setEditedRows({});
          }}
        >
          İptal Et
        </Button>
      </Stack>

      <AdminReasonDialog
        open={showReasonDialog}
        title="Matris Değişikliği Gerekçesi"
        isSubmitting={updateMutation.isPending}
        onClose={() => {
          setShowReasonDialog(false);
        }}
        onConfirm={handleSaveAll}
      />

      <AdminToastSnackbar
        message={toastMessage}
        severity={toastSeverity}
        onClose={() => {
          setToastMessage(null);
        }}
      />
    </Stack>
  );
}

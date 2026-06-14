import {
  Alert,
  Box,
  Button,
  Checkbox,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import type { FieldVisibilityLevel, UpdateFieldVisibilityBody } from '@ethics/dto';
import { Role, type Role as RoleCode } from '@ethics/shared';
import { useEffect, useMemo, useState } from 'react';

import { AdminPageHeader } from '@/features/admin/components/AdminPageHeader';
import { AdminReasonDialog } from '@/features/admin/components/AdminReasonDialog';
import {
  AdminToastSnackbar,
  type AdminToastSeverity,
} from '@/features/admin/components/AdminToastSnackbar';
import { PendingBatchActions } from '@/features/admin/components/PendingBatchActions';
import {
  FIELD_VISIBILITY_LEVEL_LABELS,
  getFieldVisibilityLabel,
  isFieldVisibilityCellDisabled,
  isVisibilityChecked,
  toggleVisibility,
} from '@/features/admin/constants/field-visibility-labels';
import { getRoleLabel } from '@/features/admin/constants/role-labels';
import {
  useApproveFieldVisibilityBatchMutation,
  useFieldVisibilityMatrixQuery,
  useUpdateFieldVisibilityMutation,
} from '@/features/admin/hooks/useAdminConfig';
import { useBeforeUnloadDirty } from '@/features/admin/hooks/useBeforeUnloadDirty';
import { getAdminErrorMessage } from '@/features/admin/utils/admin-error.util';

type CellKey = `${string}:${string}`;

type ToastSeverity = AdminToastSeverity;

function cellKey(roleCode: string, fieldName: string): CellKey {
  return `${roleCode}:${fieldName}`;
}

export function AdminFieldVisibilityPage() {
  const matrixQuery = useFieldVisibilityMatrixQuery();
  const updateMutation = useUpdateFieldVisibilityMutation();
  const approveMutation = useApproveFieldVisibilityBatchMutation();

  const [editedCells, setEditedCells] = useState<
    Record<CellKey, { original: FieldVisibilityLevel; current: FieldVisibilityLevel }>
  >({});
  const [showReasonDialog, setShowReasonDialog] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastSeverity, setToastSeverity] = useState<ToastSeverity>('success');

  const isDirty = Object.keys(editedCells).length > 0;
  useBeforeUnloadDirty(isDirty);

  const baseMatrix = useMemo(() => {
    const map = new Map<CellKey, FieldVisibilityLevel>();
    for (const item of matrixQuery.data?.matrix ?? []) {
      map.set(cellKey(item.roleCode, item.fieldName), item.visibility);
    }
    return map;
  }, [matrixQuery.data?.matrix]);

  const pendingBatchIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of matrixQuery.data?.matrix ?? []) {
      if (item.pendingBatchId) {
        ids.add(item.pendingBatchId);
      }
    }
    return [...ids];
  }, [matrixQuery.data?.matrix]);

  useEffect(() => {
    if (!matrixQuery.data) {
      return;
    }
    setEditedCells({});
  }, [matrixQuery.data]);

  const showToast = (message: string, severity: ToastSeverity) => {
    setToastMessage(message);
    setToastSeverity(severity);
  };

  const getCellVisibility = (roleCode: string, fieldName: string): FieldVisibilityLevel => {
    const key = cellKey(roleCode, fieldName);
    const edited = editedCells[key];
    if (edited) {
      return edited.current;
    }
    return baseMatrix.get(key) ?? 'hidden';
  };

  const handleToggle = (roleCode: RoleCode, fieldName: string) => {
    const key = cellKey(roleCode, fieldName);
    const original = editedCells[key]?.original ?? baseMatrix.get(key) ?? 'hidden';
    const current = getCellVisibility(roleCode, fieldName);
    const next = toggleVisibility(current, roleCode, fieldName);

    if (next === original) {
      setEditedCells((prev) => {
        const { [key]: _removed, ...rest } = prev;
        return rest;
      });
      return;
    }

    setEditedCells((prev) => ({
      ...prev,
      [key]: { original, current: next },
    }));
  };

  const handleSave = async (reason: string) => {
    const changes: UpdateFieldVisibilityBody['changes'] = Object.entries(editedCells).map(
      ([key, value]) => {
        const [roleCode, fieldName] = key.split(':') as [RoleCode, string];
        return {
          roleCode,
          fieldName: fieldName as UpdateFieldVisibilityBody['changes'][number]['fieldName'],
          visibility: value.current,
        };
      },
    );

    try {
      const result = await updateMutation.mutateAsync({ changes, reason });
      setShowReasonDialog(false);
      setEditedCells({});
      showToast(
        result.status === 'PENDING'
          ? 'Değişiklikler onay için gönderildi.'
          : 'Değişiklikler kaydedildi.',
        result.status === 'PENDING' ? 'info' : 'success',
      );
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
        <Skeleton variant="text" width={320} height={40} />
        <Skeleton variant="rounded" height={480} />
      </Stack>
    );
  }

  if (matrixQuery.isError || !matrixQuery.data) {
    return (
      <Stack spacing={2}>
        <AdminPageHeader
          title="Alan Görünürlük Yönetimi"
          description="Vaka alanlarının hangi roller tarafından görülebileceğini kontrol edin."
        />
        <Alert severity="error">{getAdminErrorMessage(matrixQuery.error)}</Alert>
        <Button onClick={() => void matrixQuery.refetch()}>Tekrar Dene</Button>
      </Stack>
    );
  }

  const { roles, fields } = matrixQuery.data;

  return (
    <Stack spacing={3}>
      <AdminPageHeader
        title="Alan Görünürlük Yönetimi"
        description="Vaka alanlarının hangi roller tarafından görülebileceğini kontrol edin."
      />

      {pendingBatchIds.map((batchId) => (
        <Box key={batchId}>
          <PendingBatchActions
            batchId={batchId}
            isSubmitting={approveMutation.isPending}
            onApprove={handleApproveBatch}
          />
        </Box>
      ))}

      <TableContainer component={Paper} sx={{ maxHeight: 640 }}>
        <Table stickyHeader size="small" aria-label="Alan görünürlük matrisi">
          <TableHead>
            <TableRow>
              <TableCell scope="col">Alan</TableCell>
              {roles.map((roleCode) => (
                <TableCell key={roleCode} scope="col" align="center">
                  {getRoleLabel(roleCode as RoleCode)}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {fields.map((fieldName) => (
              <TableRow key={fieldName}>
                <TableCell>{getFieldVisibilityLabel(fieldName)}</TableCell>
                {roles.map((roleCode) => {
                  const key = cellKey(roleCode, fieldName);
                  const isEdited = Boolean(editedCells[key]);
                  const visibility = getCellVisibility(roleCode, fieldName);
                  const { disabled, tooltip } = isFieldVisibilityCellDisabled(roleCode, fieldName);
                  const checked =
                    disabled &&
                    roleCode === Role.COUNCIL_SECRETARY &&
                    fieldName === 'secure_messages'
                      ? true
                      : isVisibilityChecked(visibility);

                  const checkbox = (
                    <Checkbox
                      checked={checked}
                      disabled={disabled || updateMutation.isPending}
                      onChange={() => {
                        handleToggle(roleCode as RoleCode, fieldName);
                      }}
                      slotProps={{
                        input: {
                          'aria-label': `${getFieldVisibilityLabel(fieldName)} — ${getRoleLabel(roleCode as RoleCode)}`,
                        },
                      }}
                    />
                  );

                  return (
                    <TableCell
                      key={key}
                      align="center"
                      sx={{ bgcolor: isEdited ? 'warning.light' : undefined }}
                    >
                      {disabled && tooltip ? (
                        <Tooltip title={tooltip}>{checkbox}</Tooltip>
                      ) : (
                        checkbox
                      )}
                      {isEdited ? (
                        <Typography variant="caption" display="block" color="text.secondary">
                          {FIELD_VISIBILITY_LEVEL_LABELS[visibility]}
                        </Typography>
                      ) : null}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {isDirty ? (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {Object.keys(editedCells).length} adet değişiklik yapıldı
          </Typography>
          <Stack spacing={0.5}>
            {Object.entries(editedCells).map(([key, value]) => {
              const [roleCode, fieldName] = key.split(':');
              return (
                <Typography key={key} variant="body2">
                  {getFieldVisibilityLabel(fieldName ?? '')} / {getRoleLabel(roleCode as RoleCode)}:{' '}
                  {FIELD_VISIBILITY_LEVEL_LABELS[value.original]} →{' '}
                  {FIELD_VISIBILITY_LEVEL_LABELS[value.current]}
                </Typography>
              );
            })}
          </Stack>
        </Paper>
      ) : null}

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
            setEditedCells({});
          }}
        >
          Değişiklikleri İptal Et
        </Button>
      </Stack>

      <AdminReasonDialog
        open={showReasonDialog}
        title="Matris Değişikliği Gerekçesi"
        isSubmitting={updateMutation.isPending}
        onClose={() => {
          setShowReasonDialog(false);
        }}
        onConfirm={handleSave}
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

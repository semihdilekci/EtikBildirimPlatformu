import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import type { SlaPolicyListItem } from '@ethics/dto';
import {
  ROLE_VALUES,
  Role,
  SLA_UNIT_VALUES,
  TaskType,
  type Role as RoleCode,
  type SlaUnitCode,
  type TaskTypeCode,
} from '@ethics/shared';
import { getTaskTypeLabel } from '@ethics/shared';
import { useState } from 'react';

import { AdminPageHeader } from '@/features/admin/components/AdminPageHeader';
import { AdminReasonDialog } from '@/features/admin/components/AdminReasonDialog';
import {
  AdminToastSnackbar,
  type AdminToastSeverity,
} from '@/features/admin/components/AdminToastSnackbar';
import { PendingBatchActions } from '@/features/admin/components/PendingBatchActions';
import { getRoleLabel } from '@/features/admin/constants/role-labels';
import {
  useApproveSlaPolicyBatchMutation,
  useSlaPoliciesQuery,
  useUpdateSlaPolicyMutation,
} from '@/features/admin/hooks/useAdminSla';
import { getAdminErrorMessage } from '@/features/admin/utils/admin-error.util';
import { formatCaseDateTime } from '@/features/cases/utils/case-format.util';

const SLA_UNIT_LABELS: Record<SlaUnitCode, string> = {
  calendar_hours: 'Takvim Saati',
  business_days: 'İş Günü',
};

const BUSINESS_RULE_TASK_TYPES = new Set<TaskTypeCode>([
  TaskType.MEMBER_APPROVAL_TASK,
  TaskType.ACTION_RESPONSE_TASK,
]);

type ToastSeverity = AdminToastSeverity;

export function AdminSlaPoliciesPage() {
  const policiesQuery = useSlaPoliciesQuery();
  const updateMutation = useUpdateSlaPolicyMutation();
  const approveMutation = useApproveSlaPolicyBatchMutation();

  const [editingPolicy, setEditingPolicy] = useState<SlaPolicyListItem | null>(null);
  const [draft, setDraft] = useState<{
    slaDuration: number;
    slaUnit: SlaUnitCode;
    warningThresholdHours: number;
    dailyOverdueNotification: boolean;
    escalationRole: RoleCode;
  }>({
    slaDuration: 0,
    slaUnit: 'calendar_hours',
    warningThresholdHours: 0,
    dailyOverdueNotification: false,
    escalationRole: Role.ADMIN,
  });
  const [showReasonDialog, setShowReasonDialog] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastSeverity, setToastSeverity] = useState<ToastSeverity>('success');

  const showToast = (message: string, severity: ToastSeverity) => {
    setToastMessage(message);
    setToastSeverity(severity);
  };

  const openEdit = (policy: SlaPolicyListItem) => {
    setEditingPolicy(policy);
    setDraft({
      slaDuration: policy.slaDuration,
      slaUnit: policy.slaUnit as SlaUnitCode,
      warningThresholdHours: policy.warningThresholdHours,
      dailyOverdueNotification: policy.dailyOverdueNotification,
      escalationRole: policy.escalationRole as RoleCode,
    });
  };

  const handleSave = async (reason: string) => {
    if (!editingPolicy) {
      return;
    }

    try {
      const result = await updateMutation.mutateAsync({
        taskType: editingPolicy.taskType,
        body: { ...draft, reason },
      });
      setShowReasonDialog(false);
      setEditingPolicy(null);
      showToast(
        result.status === 'PENDING'
          ? 'SLA değişikliği onay için gönderildi.'
          : 'SLA politikası güncellendi.',
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

  if (policiesQuery.isLoading) {
    return (
      <Stack spacing={3}>
        <Skeleton variant="text" width={300} height={40} />
        <Skeleton variant="rounded" height={420} />
      </Stack>
    );
  }

  if (policiesQuery.isError) {
    return (
      <Stack spacing={2}>
        <AdminPageHeader
          title="SLA Politika Konfigürasyonu"
          description="Görev tipi bazlı SLA sürelerini yönetin."
        />
        <Alert severity="error">{getAdminErrorMessage(policiesQuery.error)}</Alert>
        <Button onClick={() => void policiesQuery.refetch()}>Tekrar Dene</Button>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <AdminPageHeader
        title="SLA Politika Konfigürasyonu"
        description="Görev tipi bazlı SLA sürelerini yönetin. Değişiklikler maker-checker kapsamındadır."
      />

      <TableContainer component={Paper}>
        <Table size="small" aria-label="SLA politikaları">
          <TableHead>
            <TableRow>
              <TableCell scope="col">Görev Tipi</TableCell>
              <TableCell scope="col">SLA Süresi</TableCell>
              <TableCell scope="col">Birim</TableCell>
              <TableCell scope="col">Uyarı Eşiği (saat)</TableCell>
              <TableCell scope="col">Günlük Aşım Bildirimi</TableCell>
              <TableCell scope="col">Eskalasyon Rolü</TableCell>
              <TableCell scope="col">Son Güncelleme</TableCell>
              <TableCell scope="col" align="right">
                İşlem
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(policiesQuery.data ?? []).map((policy) => (
              <TableRow key={policy.taskType}>
                <TableCell>
                  <Stack spacing={0.5}>
                    <Typography variant="body2">
                      {getTaskTypeLabel(policy.taskType as TaskTypeCode)}
                    </Typography>
                    {BUSINESS_RULE_TASK_TYPES.has(policy.taskType as TaskTypeCode) ? (
                      <Typography variant="caption" color="warning.main">
                        İş kuralı SLA — dikkatli değiştirin
                      </Typography>
                    ) : null}
                  </Stack>
                </TableCell>
                <TableCell>{policy.slaDuration}</TableCell>
                <TableCell>{SLA_UNIT_LABELS[policy.slaUnit as SlaUnitCode]}</TableCell>
                <TableCell>{policy.warningThresholdHours}</TableCell>
                <TableCell>{policy.dailyOverdueNotification ? 'Aktif' : 'Pasif'}</TableCell>
                <TableCell>{getRoleLabel(policy.escalationRole as RoleCode)}</TableCell>
                <TableCell>
                  <Stack spacing={0.5}>
                    <Typography variant="body2">{formatCaseDateTime(policy.updatedAt)}</Typography>
                    {policy.pendingBatchId ? (
                      <PendingBatchActions
                        batchId={policy.pendingBatchId}
                        isSubmitting={approveMutation.isPending}
                        onApprove={handleApproveBatch}
                      />
                    ) : null}
                  </Stack>
                </TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    startIcon={<EditOutlinedIcon />}
                    disabled={Boolean(policy.pendingBatchId)}
                    onClick={() => {
                      openEdit(policy);
                    }}
                  >
                    Düzenle
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={Boolean(editingPolicy)}
        onClose={() => {
          if (!updateMutation.isPending) {
            setEditingPolicy(null);
          }
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>SLA Politikası Düzenle</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Görev Tipi"
            value={editingPolicy ? getTaskTypeLabel(editingPolicy.taskType as TaskTypeCode) : ''}
            disabled
            fullWidth
          />
          <TextField
            label="SLA Süresi"
            type="number"
            value={draft.slaDuration}
            onChange={(event) => {
              setDraft((prev) => ({ ...prev, slaDuration: Number(event.target.value) }));
            }}
            fullWidth
          />
          <FormControl fullWidth>
            <InputLabel id="sla-unit-label">Birim</InputLabel>
            <Select
              labelId="sla-unit-label"
              label="Birim"
              value={draft.slaUnit}
              onChange={(event) => {
                setDraft((prev) => ({
                  ...prev,
                  slaUnit: event.target.value as SlaUnitCode,
                }));
              }}
            >
              {SLA_UNIT_VALUES.map((unit) => (
                <MenuItem key={unit} value={unit}>
                  {SLA_UNIT_LABELS[unit]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Uyarı Eşiği (saat)"
            type="number"
            value={draft.warningThresholdHours}
            onChange={(event) => {
              setDraft((prev) => ({
                ...prev,
                warningThresholdHours: Number(event.target.value),
              }));
            }}
            fullWidth
          />
          <FormControlLabel
            control={
              <Switch
                checked={draft.dailyOverdueNotification}
                onChange={(event) => {
                  setDraft((prev) => ({
                    ...prev,
                    dailyOverdueNotification: event.target.checked,
                  }));
                }}
              />
            }
            label="Günlük aşım bildirimi"
          />
          <FormControl fullWidth>
            <InputLabel id="escalation-role-label">Eskalasyon Rolü</InputLabel>
            <Select
              labelId="escalation-role-label"
              label="Eskalasyon Rolü"
              value={draft.escalationRole}
              onChange={(event) => {
                setDraft((prev) => ({
                  ...prev,
                  escalationRole: event.target.value as RoleCode,
                }));
              }}
            >
              {ROLE_VALUES.map((role) => (
                <MenuItem key={role} value={role}>
                  {getRoleLabel(role)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setEditingPolicy(null);
            }}
            disabled={updateMutation.isPending}
          >
            İptal
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setShowReasonDialog(true);
            }}
            disabled={updateMutation.isPending}
          >
            Kaydet
          </Button>
        </DialogActions>
      </Dialog>

      <AdminReasonDialog
        open={showReasonDialog}
        title="SLA Değişikliği Gerekçesi"
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

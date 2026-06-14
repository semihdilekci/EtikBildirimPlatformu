import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Paper,
  Skeleton,
  Stack,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import type { SystemSettingListItem, SystemSettingValue } from '@ethics/dto';
import { useMemo, useState } from 'react';

import { AdminPageHeader } from '@/features/admin/components/AdminPageHeader';
import { AdminReasonDialog } from '@/features/admin/components/AdminReasonDialog';
import {
  AdminToastSnackbar,
  type AdminToastSeverity,
} from '@/features/admin/components/AdminToastSnackbar';
import { PendingBatchActions } from '@/features/admin/components/PendingBatchActions';
import {
  getSystemSettingGroupLabel,
  SYSTEM_SETTING_GROUP_ORDER,
} from '@/features/admin/constants/system-setting-groups';
import {
  useApproveSystemSettingBatchMutation,
  useSystemSettingsQuery,
  useUpdateSystemSettingMutation,
} from '@/features/admin/hooks/useAdminConfig';
import { getAdminErrorMessage } from '@/features/admin/utils/admin-error.util';
import { formatCaseDateTime } from '@/features/cases/utils/case-format.util';

type ToastSeverity = AdminToastSeverity;

function formatSettingValue(value: SystemSettingValue): string {
  if (typeof value === 'boolean') {
    return value ? 'Evet' : 'Hayır';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

export function AdminSystemSettingsPage() {
  const settingsQuery = useSystemSettingsQuery();
  const updateMutation = useUpdateSystemSettingMutation();
  const approveMutation = useApproveSystemSettingBatchMutation();

  const [activeGroup, setActiveGroup] = useState<string>('auth_cache');
  const [editingSetting, setEditingSetting] = useState<SystemSettingListItem | null>(null);
  const [draftValue, setDraftValue] = useState<SystemSettingValue>('');
  const [showReasonDialog, setShowReasonDialog] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastSeverity, setToastSeverity] = useState<ToastSeverity>('success');

  const groups = useMemo(() => {
    const fromData = new Set(settingsQuery.data?.map((item) => item.group) ?? []);
    const ordered = SYSTEM_SETTING_GROUP_ORDER.filter((group) => fromData.has(group));
    for (const group of fromData) {
      if (!ordered.includes(group as (typeof SYSTEM_SETTING_GROUP_ORDER)[number])) {
        ordered.push(group as (typeof SYSTEM_SETTING_GROUP_ORDER)[number]);
      }
    }
    return ordered;
  }, [settingsQuery.data]);

  const filteredSettings = useMemo(
    () => settingsQuery.data?.filter((item) => item.group === activeGroup) ?? [],
    [settingsQuery.data, activeGroup],
  );

  const showToast = (message: string, severity: ToastSeverity) => {
    setToastMessage(message);
    setToastSeverity(severity);
  };

  const openEditDialog = (setting: SystemSettingListItem) => {
    setEditingSetting(setting);
    setDraftValue(setting.value);
  };

  const handleSaveSetting = async (reason: string) => {
    if (!editingSetting) {
      return;
    }

    try {
      const result = await updateMutation.mutateAsync({
        key: editingSetting.key,
        body: { value: draftValue, reason },
      });
      setShowReasonDialog(false);
      setEditingSetting(null);
      showToast(
        result.status === 'PENDING'
          ? 'Ayar değişikliği onay için gönderildi.'
          : 'Ayar güncellendi.',
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

  if (settingsQuery.isLoading) {
    return (
      <Stack spacing={3}>
        <Skeleton variant="text" width={280} height={40} />
        <Skeleton variant="rounded" height={48} />
        <Skeleton variant="rounded" height={320} />
      </Stack>
    );
  }

  if (settingsQuery.isError) {
    return (
      <Stack spacing={2}>
        <AdminPageHeader
          title="Sistem Ayarları"
          description="Runtime parametrelerini görüntüleyin ve değiştirin. Her değişiklik çift onay gerektirir."
        />
        <Alert severity="error">{getAdminErrorMessage(settingsQuery.error)}</Alert>
        <Button onClick={() => void settingsQuery.refetch()}>Tekrar Dene</Button>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <AdminPageHeader
        title="Sistem Ayarları"
        description="Runtime parametrelerini görüntüleyin ve değiştirin. Her değişiklik çift onay gerektirir."
      />

      <Tabs
        value={activeGroup}
        onChange={(_event, value: string) => {
          setActiveGroup(value);
        }}
        variant="scrollable"
        scrollButtons="auto"
        aria-label="Sistem ayarı grupları"
      >
        {groups.map((group) => (
          <Tab key={group} value={group} label={getSystemSettingGroupLabel(group)} />
        ))}
      </Tabs>

      <TableContainer component={Paper}>
        <Table size="small" aria-label="Sistem ayarları">
          <TableHead>
            <TableRow>
              <TableCell scope="col">Parametre</TableCell>
              <TableCell scope="col">Açıklama</TableCell>
              <TableCell scope="col">Değer</TableCell>
              <TableCell scope="col">Birim</TableCell>
              <TableCell scope="col">Son Güncelleme</TableCell>
              <TableCell scope="col" align="right">
                İşlem
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredSettings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.secondary">
                    Bu grupta parametre yok.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredSettings.map((setting) => (
                <TableRow key={setting.key}>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      {setting.key}
                    </Typography>
                  </TableCell>
                  <TableCell>{setting.description}</TableCell>
                  <TableCell>{formatSettingValue(setting.value)}</TableCell>
                  <TableCell>{setting.unit ?? '—'}</TableCell>
                  <TableCell>
                    <Stack spacing={0.5}>
                      <Typography variant="body2">
                        {formatCaseDateTime(setting.updatedAt)}
                      </Typography>
                      {setting.updatedBy ? (
                        <Typography variant="caption" color="text.secondary">
                          {setting.updatedBy}
                        </Typography>
                      ) : null}
                      {setting.pendingBatchId ? (
                        <PendingBatchActions
                          batchId={setting.pendingBatchId}
                          isSubmitting={approveMutation.isPending}
                          onApprove={handleApproveBatch}
                        />
                      ) : null}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    {setting.mutable ? (
                      <Button
                        size="small"
                        startIcon={<EditOutlinedIcon />}
                        onClick={() => {
                          openEditDialog(setting);
                        }}
                        disabled={Boolean(setting.pendingBatchId)}
                      >
                        Düzenle
                      </Button>
                    ) : (
                      <Chip label="Salt okunur" size="small" />
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={Boolean(editingSetting)}
        onClose={() => {
          if (!updateMutation.isPending) {
            setEditingSetting(null);
          }
        }}
        fullWidth
        maxWidth="sm"
        aria-labelledby="system-setting-edit-title"
      >
        <DialogTitle id="system-setting-edit-title">Parametre Düzenle</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {editingSetting ? (
            <>
              <TextField label="Parametre" value={editingSetting.key} disabled fullWidth />
              <TextField
                label="Mevcut Değer"
                value={formatSettingValue(editingSetting.value)}
                disabled
                fullWidth
              />
              {editingSetting.valueType === 'boolean' ? (
                <FormControlLabel
                  control={
                    <Switch
                      checked={Boolean(draftValue)}
                      onChange={(event) => {
                        setDraftValue(event.target.checked);
                      }}
                    />
                  }
                  label="Yeni Değer"
                />
              ) : editingSetting.valueType === 'number' ? (
                <TextField
                  label="Yeni Değer"
                  type="number"
                  value={typeof draftValue === 'number' ? draftValue : Number(draftValue)}
                  onChange={(event) => {
                    setDraftValue(Number(event.target.value));
                  }}
                  fullWidth
                />
              ) : (
                <TextField
                  label="Yeni Değer"
                  value={
                    typeof draftValue === 'string' ? draftValue : formatSettingValue(draftValue)
                  }
                  onChange={(event) => {
                    setDraftValue(event.target.value);
                  }}
                  fullWidth
                  disabled={editingSetting.valueType === 'json'}
                />
              )}
            </>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setEditingSetting(null);
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
        title="Değişiklik Gerekçesi"
        description="Bu parametre değişikliği maker-checker onayına gönderilecektir."
        isSubmitting={updateMutation.isPending}
        onClose={() => {
          setShowReasonDialog(false);
        }}
        onConfirm={handleSaveSetting}
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

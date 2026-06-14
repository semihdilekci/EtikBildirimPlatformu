import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import type { KvkkTextListItem } from '@ethics/dto';
import { useMemo, useState } from 'react';

import { AdminPageHeader } from '@/features/admin/components/AdminPageHeader';
import {
  AdminToastSnackbar,
  type AdminToastSeverity,
} from '@/features/admin/components/AdminToastSnackbar';
import { DestructiveConfirmDialog } from '@/features/admin/components/DestructiveConfirmDialog';
import { PendingBatchActions } from '@/features/admin/components/PendingBatchActions';
import {
  useApproveKvkkTextBatchMutation,
  useCreateKvkkTextMutation,
  useKvkkTextsQuery,
} from '@/features/admin/hooks/useAdminNotificationKvkk';
import { getAdminErrorMessage } from '@/features/admin/utils/admin-error.util';
import { formatCaseDateTime } from '@/features/cases/utils/case-format.util';

const KVKK_STATUS_LABELS: Record<KvkkTextListItem['status'], string> = {
  ACTIVE: 'Aktif',
  ARCHIVED: 'Arşiv',
  DRAFT: 'Taslak',
  PENDING: 'Onay Bekliyor',
};

type ToastSeverity = AdminToastSeverity;

export function AdminKvkkTextsPage() {
  const textsQuery = useKvkkTextsQuery();
  const createMutation = useCreateKvkkTextMutation();
  const approveMutation = useApproveKvkkTextBatchMutation();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDestructiveDialog, setShowDestructiveDialog] = useState(false);
  const [viewTarget, setViewTarget] = useState<KvkkTextListItem | null>(null);
  const [draft, setDraft] = useState({
    versionCode: '',
    contentText: '',
    effectiveDate: '',
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastSeverity, setToastSeverity] = useState<ToastSeverity>('success');

  const activeVersion = useMemo(
    () => (textsQuery.data ?? []).find((item) => item.isActive),
    [textsQuery.data],
  );

  const pendingBatchIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of textsQuery.data ?? []) {
      if (item.pendingBatchId) {
        ids.add(item.pendingBatchId);
      }
    }
    return [...ids];
  }, [textsQuery.data]);

  const showToast = (message: string, severity: ToastSeverity) => {
    setToastMessage(message);
    setToastSeverity(severity);
  };

  const handlePublish = async (reason: string) => {
    try {
      const result = await createMutation.mutateAsync({
        versionCode: draft.versionCode,
        contentText: draft.contentText,
        effectiveDate: draft.effectiveDate,
        reason,
      });
      setShowDestructiveDialog(false);
      setShowCreateDialog(false);
      showToast(
        result.status === 'PENDING' ? 'KVKK metni onay için gönderildi.' : 'KVKK metni yayınlandı.',
        result.status === 'PENDING' ? 'info' : 'success',
      );
    } catch (error) {
      showToast(getAdminErrorMessage(error), 'error');
    }
  };

  const handleApproveBatch = async (batchId: string, approved: boolean, reason: string) => {
    try {
      await approveMutation.mutateAsync({ batchId, body: { approved, reason } });
      showToast(approved ? 'Yayın onaylandı.' : 'Yayın reddedildi.', approved ? 'success' : 'info');
    } catch (error) {
      showToast(getAdminErrorMessage(error), 'error');
    }
  };

  if (textsQuery.isLoading) {
    return (
      <Stack spacing={3}>
        <Skeleton variant="text" width={280} height={40} />
        <Skeleton variant="rounded" height={120} />
        <Skeleton variant="rounded" height={320} />
      </Stack>
    );
  }

  if (textsQuery.isError) {
    return (
      <Stack spacing={2}>
        <AdminPageHeader
          title="KVKK Metin Versiyonları"
          description="KVKK aydınlatma metni versiyonlarını yönetin."
        />
        <Alert severity="error">{getAdminErrorMessage(textsQuery.error)}</Alert>
        <Button onClick={() => void textsQuery.refetch()}>Tekrar Dene</Button>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <AdminPageHeader
        title="KVKK Metin Versiyonları"
        description="KVKK aydınlatma metni versiyonlarını yönetin. Yayınlama maker-checker kapsamındadır."
      />

      {pendingBatchIds.map((batchId) => (
        <PendingBatchActions
          key={batchId}
          batchId={batchId}
          isSubmitting={approveMutation.isPending}
          onApprove={handleApproveBatch}
        />
      ))}

      <Card>
        <CardContent>
          <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
            Aktif Versiyon
          </Typography>
          {activeVersion ? (
            <Stack spacing={0.5}>
              <Typography variant="body1">Versiyon {activeVersion.versionCode}</Typography>
              <Typography variant="body2" color="text.secondary">
                Yürürlük:{' '}
                {activeVersion.effectiveDate
                  ? formatCaseDateTime(activeVersion.effectiveDate)
                  : '—'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Yayın:{' '}
                {activeVersion.publishedAt ? formatCaseDateTime(activeVersion.publishedAt) : '—'}
              </Typography>
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Aktif versiyon bulunamadı.
            </Typography>
          )}
        </CardContent>
      </Card>

      <Box>
        <Button
          variant="contained"
          startIcon={<AddOutlinedIcon />}
          onClick={() => {
            setDraft({ versionCode: '', contentText: '', effectiveDate: '' });
            setShowCreateDialog(true);
          }}
        >
          Yeni Versiyon Oluştur
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table size="small" aria-label="KVKK versiyon geçmişi">
          <TableHead>
            <TableRow>
              <TableCell scope="col">Versiyon</TableCell>
              <TableCell scope="col">Yürürlük</TableCell>
              <TableCell scope="col">Durum</TableCell>
              <TableCell scope="col">Güncelleme</TableCell>
              <TableCell scope="col" align="right">
                İşlem
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(textsQuery.data ?? []).map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.versionCode}</TableCell>
                <TableCell>
                  {item.effectiveDate ? formatCaseDateTime(item.effectiveDate) : '—'}
                </TableCell>
                <TableCell>
                  <Chip
                    label={KVKK_STATUS_LABELS[item.status]}
                    color={
                      item.isActive ? 'success' : item.status === 'PENDING' ? 'warning' : 'default'
                    }
                    size="small"
                  />
                </TableCell>
                <TableCell>{formatCaseDateTime(item.updatedAt)}</TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    startIcon={<VisibilityOutlinedIcon />}
                    onClick={() => {
                      setViewTarget(item);
                    }}
                  >
                    Görüntüle
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={showCreateDialog}
        onClose={() => {
          if (!createMutation.isPending) {
            setShowCreateDialog(false);
          }
        }}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Yeni KVKK Versiyonu</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Versiyon Kodu"
            placeholder="1.2"
            value={draft.versionCode}
            onChange={(event) => {
              setDraft((prev) => ({ ...prev, versionCode: event.target.value }));
            }}
            fullWidth
          />
          <TextField
            label="Yürürlük Tarihi"
            type="date"
            value={draft.effectiveDate}
            onChange={(event) => {
              setDraft((prev) => ({ ...prev, effectiveDate: event.target.value }));
            }}
            slotProps={{ inputLabel: { shrink: true } }}
            fullWidth
          />
          <TextField
            label="Metin"
            value={draft.contentText}
            onChange={(event) => {
              setDraft((prev) => ({ ...prev, contentText: event.target.value }));
            }}
            multiline
            minRows={12}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setShowCreateDialog(false);
            }}
            disabled={createMutation.isPending}
          >
            İptal
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={
              createMutation.isPending ||
              !draft.versionCode ||
              !draft.effectiveDate ||
              draft.contentText.length < 20
            }
            onClick={() => {
              setShowDestructiveDialog(true);
            }}
          >
            Yayınla
          </Button>
        </DialogActions>
      </Dialog>

      <DestructiveConfirmDialog
        open={showDestructiveDialog}
        title="KVKK Metni Yayınla"
        description="Bu işlem yeni bir KVKK versiyonu yayınlayacaktır. Mevcut aktif versiyon arşivlenecektir. Geri alınamaz."
        isSubmitting={createMutation.isPending}
        onClose={() => {
          setShowDestructiveDialog(false);
        }}
        onConfirm={handlePublish}
      />

      <Dialog
        open={Boolean(viewTarget)}
        onClose={() => {
          setViewTarget(null);
        }}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Versiyon {viewTarget?.versionCode}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {viewTarget?.contentText}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setViewTarget(null);
            }}
          >
            Kapat
          </Button>
        </DialogActions>
      </Dialog>

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

import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PreviewOutlinedIcon from '@mui/icons-material/PreviewOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import type { NotificationTemplateListItem } from '@ethics/dto';
import { useState } from 'react';

import { AdminPageHeader } from '@/features/admin/components/AdminPageHeader';
import { AdminReasonDialog } from '@/features/admin/components/AdminReasonDialog';
import {
  AdminToastSnackbar,
  type AdminToastSeverity,
} from '@/features/admin/components/AdminToastSnackbar';
import { PendingBatchActions } from '@/features/admin/components/PendingBatchActions';
import {
  useApproveNotificationTemplateBatchMutation,
  useNotificationTemplatesQuery,
  usePreviewNotificationTemplateMutation,
  useSendTestNotificationTemplateMutation,
  useUpdateNotificationTemplateMutation,
} from '@/features/admin/hooks/useAdminNotificationKvkk';
import { getAdminErrorMessage } from '@/features/admin/utils/admin-error.util';
import { formatCaseDateTime } from '@/features/cases/utils/case-format.util';

type ToastSeverity = AdminToastSeverity;

export function AdminNotificationTemplatesPage() {
  const templatesQuery = useNotificationTemplatesQuery();
  const updateMutation = useUpdateNotificationTemplateMutation();
  const approveMutation = useApproveNotificationTemplateBatchMutation();
  const previewMutation = usePreviewNotificationTemplateMutation();
  const sendTestMutation = useSendTestNotificationTemplateMutation();

  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplateListItem | null>(null);
  const [draft, setDraft] = useState({
    name: '',
    subjectTemplate: '',
    bodyTemplate: '',
    isActive: true,
  });
  const [previewResult, setPreviewResult] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [showReasonDialog, setShowReasonDialog] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastSeverity, setToastSeverity] = useState<ToastSeverity>('success');

  const showToast = (message: string, severity: ToastSeverity) => {
    setToastMessage(message);
    setToastSeverity(severity);
  };

  const openEdit = (template: NotificationTemplateListItem) => {
    setEditingTemplate(template);
    setDraft({
      name: template.name,
      subjectTemplate: template.subjectTemplate ?? '',
      bodyTemplate: template.bodyTemplate,
      isActive: template.isActive,
    });
    setPreviewResult(null);
    setTestEmail('');
  };

  const handlePreview = async () => {
    if (!editingTemplate) {
      return;
    }

    try {
      const result = await previewMutation.mutateAsync({
        templateCode: editingTemplate.templateCode,
        body: {
          subjectTemplate: draft.subjectTemplate || null,
          bodyTemplate: draft.bodyTemplate,
        },
      });
      setPreviewResult(result.textBody);
      showToast('Önizleme oluşturuldu.', 'success');
    } catch (error) {
      showToast(getAdminErrorMessage(error), 'error');
    }
  };

  const handleSendTest = async () => {
    if (!editingTemplate || !testEmail) {
      return;
    }

    try {
      await sendTestMutation.mutateAsync({
        templateCode: editingTemplate.templateCode,
        body: {
          subjectTemplate: draft.subjectTemplate || null,
          bodyTemplate: draft.bodyTemplate,
          recipientEmail: testEmail,
        },
      });
      showToast('Test e-postası gönderildi.', 'success');
    } catch (error) {
      showToast(getAdminErrorMessage(error), 'error');
    }
  };

  const handleSave = async (reason: string) => {
    if (!editingTemplate) {
      return;
    }

    try {
      const result = await updateMutation.mutateAsync({
        templateCode: editingTemplate.templateCode,
        body: {
          name: draft.name,
          subjectTemplate: draft.subjectTemplate || null,
          bodyTemplate: draft.bodyTemplate,
          isActive: draft.isActive,
          reason,
        },
      });
      setShowReasonDialog(false);
      setEditingTemplate(null);
      showToast(
        result.status === 'PENDING'
          ? 'Şablon değişikliği onay için gönderildi.'
          : 'Şablon güncellendi.',
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

  if (templatesQuery.isLoading) {
    return (
      <Stack spacing={3}>
        <Skeleton variant="text" width={320} height={40} />
        <Skeleton variant="rounded" height={420} />
      </Stack>
    );
  }

  if (templatesQuery.isError) {
    return (
      <Stack spacing={2}>
        <AdminPageHeader
          title="Bildirim Şablonları"
          description="Bildirim şablonlarını düzenleyin. Kritik değişiklikler maker-checker kapsamındadır."
        />
        <Alert severity="error">{getAdminErrorMessage(templatesQuery.error)}</Alert>
        <Button onClick={() => void templatesQuery.refetch()}>Tekrar Dene</Button>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <AdminPageHeader
        title="Bildirim Şablonları"
        description="Bildirim şablonlarını düzenleyin. Placeholder'lar runtime'da güvenli değerlerle doldurulur."
      />

      <TableContainer component={Paper}>
        <Table size="small" aria-label="Bildirim şablonları">
          <TableHead>
            <TableRow>
              <TableCell scope="col">Kod</TableCell>
              <TableCell scope="col">Ad</TableCell>
              <TableCell scope="col">Kanal</TableCell>
              <TableCell scope="col">Durum</TableCell>
              <TableCell scope="col">Versiyon</TableCell>
              <TableCell scope="col">Son Güncelleme</TableCell>
              <TableCell scope="col" align="right">
                İşlem
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(templatesQuery.data ?? []).map((template) => (
              <TableRow key={template.templateCode} hover>
                <TableCell>
                  <Typography variant="body2" fontFamily="monospace">
                    {template.templateCode}
                  </Typography>
                </TableCell>
                <TableCell>{template.name}</TableCell>
                <TableCell>{template.channel}</TableCell>
                <TableCell>
                  <Chip
                    label={template.isActive ? 'Aktif' : 'Pasif'}
                    color={template.isActive ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>{template.versionNo}</TableCell>
                <TableCell>
                  <Stack spacing={0.5}>
                    <Typography variant="body2">
                      {formatCaseDateTime(template.updatedAt)}
                    </Typography>
                    {template.pendingBatchId ? (
                      <PendingBatchActions
                        batchId={template.pendingBatchId}
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
                    disabled={Boolean(template.pendingBatchId)}
                    onClick={() => {
                      openEdit(template);
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
        open={Boolean(editingTemplate)}
        onClose={() => {
          if (!updateMutation.isPending) {
            setEditingTemplate(null);
          }
        }}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Şablon Düzenle</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Şablon Kodu"
            value={editingTemplate?.templateCode ?? ''}
            disabled
            fullWidth
          />
          <TextField
            label="Şablon Adı"
            value={draft.name}
            onChange={(event) => {
              setDraft((prev) => ({ ...prev, name: event.target.value }));
            }}
            fullWidth
          />
          <TextField
            label="Konu Şablonu"
            value={draft.subjectTemplate}
            onChange={(event) => {
              setDraft((prev) => ({ ...prev, subjectTemplate: event.target.value }));
            }}
            fullWidth
          />
          <TextField
            label="Metin Şablonu"
            value={draft.bodyTemplate}
            onChange={(event) => {
              setDraft((prev) => ({ ...prev, bodyTemplate: event.target.value }));
            }}
            multiline
            minRows={8}
            fullWidth
          />
          <FormControlLabel
            control={
              <Switch
                checked={draft.isActive}
                onChange={(event) => {
                  setDraft((prev) => ({ ...prev, isActive: event.target.checked }));
                }}
              />
            }
            label="Aktif"
          />
          <Typography variant="caption" color="text.secondary">
            Placeholder referansı: {'{{taskTypeLabel}}'}, {'{{dueDate}}'}, {'{{caseId}}'}
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<PreviewOutlinedIcon />}
              onClick={() => void handlePreview()}
              disabled={previewMutation.isPending}
            >
              Önizle
            </Button>
            <TextField
              label="Test e-posta"
              value={testEmail}
              onChange={(event) => {
                setTestEmail(event.target.value);
              }}
              size="small"
              sx={{ flex: 1 }}
            />
            <Button
              variant="outlined"
              startIcon={<SendOutlinedIcon />}
              onClick={() => void handleSendTest()}
              disabled={sendTestMutation.isPending || !testEmail}
            >
              Test Gönder
            </Button>
          </Stack>
          {previewResult ? (
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Önizleme
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {previewResult}
              </Typography>
            </Paper>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setEditingTemplate(null);
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
        title="Şablon Değişikliği Gerekçesi"
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

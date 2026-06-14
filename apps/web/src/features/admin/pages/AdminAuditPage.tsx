import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
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
  TextField,
  Typography,
} from '@mui/material';
import type { AdminAuditEventItem } from '@ethics/dto';
import { AUDIT_EVENT_TYPE_VALUES } from '@ethics/shared';
import { useRef, useState } from 'react';

import { AdminPageHeader } from '@/features/admin/components/AdminPageHeader';
import { AdminReasonDialog } from '@/features/admin/components/AdminReasonDialog';
import { AuditEventDetailDrawer } from '@/features/admin/components/AuditEventDetailDrawer';
import {
  AdminToastSnackbar,
  type AdminToastSeverity,
} from '@/features/admin/components/AdminToastSnackbar';
import { getAuditEventTypeLabel } from '@/features/admin/constants/audit-event-labels';
import { useAdminAuditFilters } from '@/features/admin/hooks/useAdminAuditFilters';
import {
  useAdminAuditEventsQuery,
  useAdminAuditExportJobQuery,
  useRequestAdminAuditExportMutation,
  useVerifyAdminAuditChainMutation,
} from '@/features/admin/hooks/useAdminMonitoring';
import { getAdminErrorMessage } from '@/features/admin/utils/admin-error.util';
import { formatCaseDateTime, formatShortCaseId } from '@/features/cases/utils/case-format.util';

function outcomeChipColor(outcome: string): 'success' | 'error' | 'default' {
  if (outcome === 'SUCCESS') {
    return 'success';
  }
  if (outcome === 'DENIED' || outcome === 'FAILED') {
    return 'error';
  }
  return 'default';
}

export function AdminAuditPage() {
  const cursorHistoryRef = useRef<string[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<AdminAuditEventItem | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportJobId, setExportJobId] = useState<string | null>(null);
  const [chainVerifyResult, setChainVerifyResult] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastSeverity, setToastSeverity] = useState<AdminToastSeverity>('success');

  const {
    filters,
    uiFilters,
    hasActiveFilters,
    setEventTypeFilter,
    setActorUserIdFilter,
    setResourceTypeFilter,
    setResourceIdFilter,
    setDateFromFilter,
    setDateToFilter,
    setCursor,
    toggleFiltersExpanded,
    clearFilters,
  } = useAdminAuditFilters();

  const auditQuery = useAdminAuditEventsQuery(filters);
  const exportMutation = useRequestAdminAuditExportMutation();
  const exportJobQuery = useAdminAuditExportJobQuery(exportJobId);
  const chainVerifyMutation = useVerifyAdminAuditChainMutation();

  const items = auditQuery.data?.items ?? [];
  const nextCursor = auditQuery.data?.nextCursor ?? null;

  const showToast = (message: string, severity: AdminToastSeverity) => {
    setToastMessage(message);
    setToastSeverity(severity);
  };

  const handleCopyCorrelationId = async (correlationId: string) => {
    try {
      await navigator.clipboard.writeText(correlationId);
      showToast('Correlation ID kopyalandı.', 'success');
    } catch {
      showToast('Kopyalama başarısız.', 'error');
    }
  };

  const handleNextPage = () => {
    if (!nextCursor) {
      return;
    }
    cursorHistoryRef.current.push(filters.cursor ?? '');
    setCursor(nextCursor);
  };

  const handlePreviousPage = () => {
    const previousCursor = cursorHistoryRef.current.pop();
    setCursor(previousCursor && previousCursor.length > 0 ? previousCursor : null);
  };

  const handleClearFilters = () => {
    cursorHistoryRef.current = [];
    clearFilters();
  };

  const handleExport = async (reason: string) => {
    try {
      const { limit: _limit, cursor: _cursor, ...exportFilters } = filters;
      const job = await exportMutation.mutateAsync({
        ...exportFilters,
        reason,
      });
      setExportJobId(job.id);
      setShowExportDialog(false);
      showToast('CSV dışa aktarma işi başlatıldı.', 'info');
    } catch (error) {
      showToast(getAdminErrorMessage(error), 'error');
    }
  };

  const handleVerifyChain = async () => {
    try {
      const result = await chainVerifyMutation.mutateAsync();
      const message = result.valid
        ? `Zincir bütünlüğü doğrulandı (${String(result.eventCount)} kayıt).`
        : `Zincir bütünlüğü bozuk — kırılma: ${result.brokenAtEventId ?? 'bilinmiyor'}.`;
      setChainVerifyResult(message);
      showToast(message, result.valid ? 'success' : 'error');
    } catch (error) {
      showToast(getAdminErrorMessage(error), 'error');
    }
  };

  const completedExportJob = exportJobQuery.data;
  const exportDownloadUrl =
    completedExportJob?.status === 'COMPLETED' ? completedExportJob.downloadUrl : null;
  const exportRowCount =
    completedExportJob?.status === 'COMPLETED' ? completedExportJob.rowCount : null;

  return (
    <Stack spacing={3}>
      <AdminPageHeader
        title="Audit Log"
        description="Sistem denetim kayıtları. İçerik verileri gösterilmez — yalnızca maskeli metadata."
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end">
        <Button
          variant="outlined"
          startIcon={<VerifiedUserOutlinedIcon />}
          onClick={() => void handleVerifyChain()}
          disabled={chainVerifyMutation.isPending}
        >
          Zincir Doğrula
        </Button>
        <Button
          variant="contained"
          startIcon={<FileDownloadOutlinedIcon />}
          onClick={() => {
            setShowExportDialog(true);
          }}
        >
          CSV Dışa Aktar
        </Button>
      </Stack>

      {chainVerifyResult ? (
        <Alert severity={chainVerifyResult.includes('doğrulandı') ? 'success' : 'error'}>
          {chainVerifyResult}
        </Alert>
      ) : null}

      {exportJobId && exportJobQuery.isLoading ? (
        <Alert severity="info">CSV dışa aktarma hazırlanıyor…</Alert>
      ) : null}

      {exportDownloadUrl ? (
        <Alert severity="success">
          Dışa aktarma tamamlandı ({String(exportRowCount ?? 0)} kayıt).{' '}
          <Button size="small" href={exportDownloadUrl} target="_blank" rel="noopener noreferrer">
            İndir
          </Button>
        </Alert>
      ) : null}

      {exportJobQuery.data?.status === 'FAILED' ? (
        <Alert severity="error">
          Dışa aktarma başarısız: {exportJobQuery.data.errorCode ?? 'Bilinmeyen hata'}
        </Alert>
      ) : null}

      <Accordion
        expanded={uiFilters.filtersExpanded}
        onChange={() => {
          toggleFiltersExpanded();
        }}
        disableGutters
        elevation={0}
        sx={{ border: 1, borderColor: 'divider', borderRadius: 1, '&:before': { display: 'none' } }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2">Filtreler</Typography>
          {hasActiveFilters ? (
            <Chip label="Aktif" size="small" color="primary" sx={{ ml: 1 }} />
          ) : null}
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <FormControl fullWidth size="small">
                <InputLabel id="audit-event-type-label">Olay Tipi</InputLabel>
                <Select
                  labelId="audit-event-type-label"
                  label="Olay Tipi"
                  value={uiFilters.eventType}
                  onChange={(event) => {
                    setEventTypeFilter(event.target.value);
                  }}
                >
                  <MenuItem value="">Tümü</MenuItem>
                  {AUDIT_EVENT_TYPE_VALUES.map((eventType) => (
                    <MenuItem key={eventType} value={eventType}>
                      {getAuditEventTypeLabel(eventType)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Aktör Kullanıcı ID"
                size="small"
                fullWidth
                value={uiFilters.actorUserId}
                onChange={(event) => {
                  setActorUserIdFilter(event.target.value);
                }}
              />
            </Stack>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                label="Kaynak Tipi"
                size="small"
                fullWidth
                value={uiFilters.resourceType}
                onChange={(event) => {
                  setResourceTypeFilter(event.target.value);
                }}
              />
              <TextField
                label="Kaynak ID"
                size="small"
                fullWidth
                value={uiFilters.resourceId}
                onChange={(event) => {
                  setResourceIdFilter(event.target.value);
                }}
              />
            </Stack>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                label="Başlangıç Tarihi"
                type="date"
                size="small"
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
                value={uiFilters.dateFrom}
                onChange={(event) => {
                  setDateFromFilter(event.target.value);
                }}
              />
              <TextField
                label="Bitiş Tarihi"
                type="date"
                size="small"
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
                value={uiFilters.dateTo}
                onChange={(event) => {
                  setDateToFilter(event.target.value);
                }}
              />
            </Stack>
            {hasActiveFilters ? (
              <Box>
                <Button size="small" onClick={handleClearFilters}>
                  Filtreleri Temizle
                </Button>
              </Box>
            ) : null}
          </Stack>
        </AccordionDetails>
      </Accordion>

      {auditQuery.isError ? (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => void auditQuery.refetch()}>
              Tekrar Dene
            </Button>
          }
        >
          {getAdminErrorMessage(auditQuery.error)}
        </Alert>
      ) : null}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small" aria-label="Audit log tablosu">
          <TableHead>
            <TableRow>
              <TableCell scope="col">Zaman</TableCell>
              <TableCell scope="col">Olay Tipi</TableCell>
              <TableCell scope="col">Aktör</TableCell>
              <TableCell scope="col">Kaynak</TableCell>
              <TableCell scope="col">Sonuç</TableCell>
              <TableCell scope="col">Correlation ID</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {auditQuery.isLoading
              ? Array.from({ length: 10 }).map((_, index) => (
                  <TableRow key={`skeleton-${String(index)}`}>
                    {Array.from({ length: 6 }).map((__, cellIndex) => (
                      <TableCell key={`cell-${String(cellIndex)}`}>
                        <Skeleton />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : null}

            {!auditQuery.isLoading && items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Filtre kriterlerine uygun denetim kaydı bulunamadı.
                  </Typography>
                  {hasActiveFilters ? (
                    <Button size="small" onClick={handleClearFilters}>
                      Filtreleri Temizle
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ) : null}

            {!auditQuery.isLoading
              ? items.map((item) => (
                  <TableRow
                    key={item.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => {
                      setSelectedEvent(item);
                    }}
                  >
                    <TableCell>{formatCaseDateTime(item.occurredAt)}</TableCell>
                    <TableCell>
                      <Chip
                        label={getAuditEventTypeLabel(item.eventType)}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace" fontSize="0.75rem">
                        {item.actorId ? formatShortCaseId(item.actorId) : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {item.resourceType ?? '—'}
                      {item.resourceId ? ` / ${formatShortCaseId(item.resourceId)}` : ''}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={item.outcome}
                        size="small"
                        color={outcomeChipColor(item.outcome)}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace" fontSize="0.75rem">
                        {item.correlationId ? formatShortCaseId(item.correlationId) : '—'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))
              : null}
          </TableBody>
        </Table>
      </TableContainer>

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="caption" color="text.secondary">
          Cursor tabanlı sayfalama — toplam kayıt sayısı gösterilmez.
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            disabled={cursorHistoryRef.current.length === 0}
            onClick={handlePreviousPage}
          >
            Önceki
          </Button>
          <Button size="small" disabled={!nextCursor} onClick={handleNextPage}>
            Sonraki
          </Button>
        </Stack>
      </Stack>

      <AuditEventDetailDrawer
        event={selectedEvent}
        open={Boolean(selectedEvent)}
        onClose={() => {
          setSelectedEvent(null);
        }}
        onCopyCorrelationId={(correlationId) => void handleCopyCorrelationId(correlationId)}
      />

      <AdminReasonDialog
        open={showExportDialog}
        title="CSV Dışa Aktarma"
        description="Mevcut filtrelerle denetim kayıtları dışa aktarılacaktır. Gerekçe zorunludur."
        confirmLabel="Dışa Aktar"
        isSubmitting={exportMutation.isPending}
        onClose={() => {
          setShowExportDialog(false);
        }}
        onConfirm={handleExport}
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

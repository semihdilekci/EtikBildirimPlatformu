import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  Grid2 as Grid,
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
import type { AdminDocumentOperationItem } from '@ethics/dto';
import { MALWARE_SCAN_STATUS_VALUES } from '@ethics/shared';
import { useRef, useState } from 'react';

import { AdminPageHeader } from '@/features/admin/components/AdminPageHeader';
import {
  formatBytes,
  getMalwareScanStatusColor,
  getMalwareScanStatusLabel,
} from '@/features/admin/constants/monitoring-labels';
import { useAdminDocumentOpsFilters } from '@/features/admin/hooks/useAdminDocumentOpsFilters';
import { useAdminDocumentOperationsQuery } from '@/features/admin/hooks/useAdminMonitoring';
import { getAdminErrorMessage } from '@/features/admin/utils/admin-error.util';
import { formatCaseDateTime, formatShortCaseId } from '@/features/cases/utils/case-format.util';

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: 'warning' | 'error' | 'success' | 'default';
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
      <Typography
        variant="h5"
        color={
          color === 'warning'
            ? 'warning.main'
            : color === 'error'
              ? 'error.main'
              : color === 'success'
                ? 'success.main'
                : 'text.primary'
        }
      >
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Paper>
  );
}

function DocumentDetailPanel({ item }: { item: AdminDocumentOperationItem }) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle2" gutterBottom>
        Doküman Detayı (teknik metadata)
      </Typography>
      <Stack spacing={1}>
        <Typography variant="body2">
          <strong>Doküman ID:</strong> {item.documentId}
        </Typography>
        <Typography variant="body2">
          <strong>Vaka ID:</strong> {formatShortCaseId(item.caseId)}
        </Typography>
        <Typography variant="body2">
          <strong>Kategori:</strong> {item.documentCategory}
        </Typography>
        <Typography variant="body2">
          <strong>Durum:</strong> {item.documentStatus}
        </Typography>
        <Typography variant="body2">
          <strong>MIME:</strong> {item.mimeType}
        </Typography>
        <Typography variant="body2">
          <strong>Boyut:</strong> {formatBytes(item.sizeBytes)}
        </Typography>
        <Typography variant="body2">
          <strong>Hash (SHA-256 önek):</strong>{' '}
          <Box component="span" fontFamily="monospace">
            {item.contentSha256Prefix}
          </Box>
        </Typography>
        <Typography variant="body2">
          <strong>Yükleme:</strong> {formatCaseDateTime(item.uploadedAt)}
        </Typography>
        <Typography variant="body2">
          <strong>Tarama:</strong>{' '}
          {item.scannedAt ? formatCaseDateTime(item.scannedAt) : 'Henüz taranmadı'}
        </Typography>
        <Alert severity="info" sx={{ mt: 1 }}>
          Dosya içeriği önizlenemez ve indirilemez — yalnızca teknik metadata görüntülenir.
        </Alert>
      </Stack>
    </Paper>
  );
}

export function AdminDocumentOpsPage() {
  const cursorHistoryRef = useRef<string[]>([]);
  const [selectedItem, setSelectedItem] = useState<AdminDocumentOperationItem | null>(null);

  const {
    filters,
    uiFilters,
    hasActiveFilters,
    setScanStatusFilter,
    setMimeTypeFilter,
    setDateFromFilter,
    setDateToFilter,
    setCursor,
    clearFilters,
  } = useAdminDocumentOpsFilters();

  const opsQuery = useAdminDocumentOperationsQuery(filters);
  const summary = opsQuery.data?.summary;
  const items = opsQuery.data?.items ?? [];
  const nextCursor = opsQuery.data?.nextCursor ?? null;

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

  return (
    <Stack spacing={3}>
      <AdminPageHeader
        title="Doküman Operasyonları"
        description="Doküman teknik metadata izleme ve tarama durumu. Dosya içeriği gösterilmez."
      />

      {opsQuery.isLoading ? (
        <Grid container spacing={2}>
          {Array.from({ length: 5 }).map((_, index) => (
            <Grid key={`summary-skel-${String(index)}`} size={{ xs: 6, sm: 4, md: 2.4 }}>
              <Skeleton variant="rounded" height={80} />
            </Grid>
          ))}
        </Grid>
      ) : summary ? (
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
            <SummaryCard label="Toplam" value={summary.totalDocuments} />
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
            <SummaryCard label="Tarama Bekliyor" value={summary.pendingScanCount} color="warning" />
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
            <SummaryCard label="Karantina" value={summary.quarantinedCount} color="warning" />
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
            <SummaryCard label="Reddedildi" value={summary.rejectedCount} color="error" />
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
            <SummaryCard label="Temiz" value={summary.cleanCount} color="success" />
          </Grid>
        </Grid>
      ) : null}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <FormControl fullWidth size="small">
            <InputLabel id="doc-scan-status-label">Tarama Durumu</InputLabel>
            <Select
              labelId="doc-scan-status-label"
              label="Tarama Durumu"
              value={uiFilters.scanStatus}
              onChange={(event) => {
                setScanStatusFilter(event.target.value);
              }}
            >
              <MenuItem value="">Tümü</MenuItem>
              {MALWARE_SCAN_STATUS_VALUES.map((status) => (
                <MenuItem key={status} value={status}>
                  {getMalwareScanStatusLabel(status)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="MIME Tipi"
            size="small"
            fullWidth
            value={uiFilters.mimeType}
            onChange={(event) => {
              setMimeTypeFilter(event.target.value);
            }}
          />
          <TextField
            label="Başlangıç"
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
            label="Bitiş"
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
          <Button size="small" sx={{ mt: 1 }} onClick={clearFilters}>
            Filtreleri Temizle
          </Button>
        ) : null}
      </Paper>

      {opsQuery.isError ? (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => void opsQuery.refetch()}>
              Tekrar Dene
            </Button>
          }
        >
          {getAdminErrorMessage(opsQuery.error)}
        </Alert>
      ) : null}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small" aria-label="Doküman operasyonları tablosu">
          <TableHead>
            <TableRow>
              <TableCell scope="col">Doküman ID</TableCell>
              <TableCell scope="col">Vaka</TableCell>
              <TableCell scope="col">Kategori</TableCell>
              <TableCell scope="col">Boyut</TableCell>
              <TableCell scope="col">MIME</TableCell>
              <TableCell scope="col">Tarama</TableCell>
              <TableCell scope="col">Hash</TableCell>
              <TableCell scope="col">Yükleme</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {opsQuery.isLoading
              ? Array.from({ length: 8 }).map((_, index) => (
                  <TableRow key={`doc-skel-${String(index)}`}>
                    {Array.from({ length: 8 }).map((__, cellIndex) => (
                      <TableCell key={`doc-cell-${String(cellIndex)}`}>
                        <Skeleton />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : null}

            {!opsQuery.isLoading && items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Filtre kriterlerine uygun doküman kaydı bulunamadı.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : null}

            {!opsQuery.isLoading
              ? items.map((item) => (
                  <TableRow
                    key={item.documentId}
                    hover
                    selected={selectedItem?.documentId === item.documentId}
                    sx={{
                      cursor: 'pointer',
                      bgcolor: item.malwareScanStatus === 'QUARANTINED' ? 'warning.50' : undefined,
                    }}
                    onClick={() => {
                      setSelectedItem(item);
                    }}
                  >
                    <TableCell>
                      <Typography fontFamily="monospace" fontSize="0.75rem">
                        {formatShortCaseId(item.documentId)}
                      </Typography>
                    </TableCell>
                    <TableCell>{formatShortCaseId(item.caseId)}</TableCell>
                    <TableCell>{item.documentCategory}</TableCell>
                    <TableCell>{formatBytes(item.sizeBytes)}</TableCell>
                    <TableCell>{item.mimeType}</TableCell>
                    <TableCell>
                      <Chip
                        label={getMalwareScanStatusLabel(item.malwareScanStatus)}
                        size="small"
                        color={getMalwareScanStatusColor(item.malwareScanStatus)}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography component="span" fontFamily="monospace" fontSize="0.75rem">
                        {item.contentSha256Prefix}
                      </Typography>
                    </TableCell>
                    <TableCell>{formatCaseDateTime(item.uploadedAt)}</TableCell>
                  </TableRow>
                ))
              : null}
          </TableBody>
        </Table>
      </TableContainer>

      <Stack direction="row" justifyContent="flex-end" spacing={1}>
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

      {selectedItem ? <DocumentDetailPanel item={selectedItem} /> : null}
    </Stack>
  );
}

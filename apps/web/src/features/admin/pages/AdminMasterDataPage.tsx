import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  Grid2 as Grid,
  Paper,
  Popover,
  Skeleton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from '@mui/material';
import type { AdminMasterDataItem, AdminMasterDataSyncRun } from '@ethics/dto';
import { MasterDataType } from '@ethics/shared';
import { useState } from 'react';

import { AdminPageHeader } from '@/features/admin/components/AdminPageHeader';
import {
  formatSyncDuration,
  getMasterDataSyncStatusColor,
  MASTER_DATA_SYNC_STATUS_LABELS,
} from '@/features/admin/constants/master-data-labels';
import {
  useAdminMasterDataCompaniesQuery,
  useAdminMasterDataFunctionsQuery,
  useAdminMasterDataLocationsQuery,
  useAdminMasterDataSyncRunsQuery,
} from '@/features/admin/hooks/useAdminMasterData';
import { getAdminErrorMessage } from '@/features/admin/utils/admin-error.util';
import { formatCaseDateTime } from '@/features/cases/utils/case-format.util';

type MasterDataTab =
  | typeof MasterDataType.COMPANY
  | typeof MasterDataType.LOCATION
  | typeof MasterDataType.FUNCTION;

const MASTER_DATA_TAB_LABELS: Record<MasterDataTab, string> = {
  [MasterDataType.COMPANY]: 'Şirketler',
  [MasterDataType.LOCATION]: 'Lokasyonlar',
  [MasterDataType.FUNCTION]: 'Fonksiyonlar',
};

function SyncSummaryCard({ latestRun }: { latestRun: AdminMasterDataSyncRun | null }) {
  if (!latestRun) {
    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Henüz senkron koşusu kaydı bulunmuyor.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          flexWrap="wrap"
          gap={1}
        >
          <Typography variant="subtitle1" fontWeight={600}>
            Son Senkron Özeti
          </Typography>
          <Chip
            label={MASTER_DATA_SYNC_STATUS_LABELS[latestRun.status]}
            size="small"
            color={getMasterDataSyncStatusColor(latestRun.status)}
          />
        </Stack>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Typography variant="caption" color="text.secondary" display="block">
              Entegrasyon
            </Typography>
            <Typography variant="body2">{latestRun.integrationName}</Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Typography variant="caption" color="text.secondary" display="block">
              Son Çalışma
            </Typography>
            <Typography variant="body2">{formatCaseDateTime(latestRun.startedAt)}</Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Typography variant="caption" color="text.secondary" display="block">
              İşlenen Kayıt
            </Typography>
            <Typography variant="body2">{latestRun.recordCount}</Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Typography variant="caption" color="text.secondary" display="block">
              Hata Sayısı
            </Typography>
            <Typography
              variant="body2"
              color={latestRun.errorCount > 0 ? 'error.main' : 'text.primary'}
            >
              {latestRun.errorCount}
            </Typography>
          </Grid>
        </Grid>
      </Stack>
    </Paper>
  );
}

function MasterDataTable({
  items,
  showCompany,
}: {
  items: AdminMasterDataItem[];
  showCompany: boolean;
}) {
  if (items.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
        Kayıt bulunamadı.
      </Typography>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small" aria-label="Master data tablosu">
        <TableHead>
          <TableRow>
            <TableCell>Ad</TableCell>
            <TableCell>Kod</TableCell>
            {showCompany ? <TableCell>Şirket</TableCell> : null}
            <TableCell>Kaynak ID</TableCell>
            <TableCell>Durum</TableCell>
            <TableCell>Son Sync</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id} hover>
              <TableCell>{item.name}</TableCell>
              <TableCell>{item.code}</TableCell>
              {showCompany ? <TableCell>{item.companyName ?? '—'}</TableCell> : null}
              <TableCell>{item.sourceRecordId ?? '—'}</TableCell>
              <TableCell>
                <Chip
                  label={item.isActive ? 'Aktif' : 'Pasif'}
                  size="small"
                  color={item.isActive ? 'success' : 'default'}
                  variant="outlined"
                />
              </TableCell>
              <TableCell>
                {item.sourceUpdatedAt ? formatCaseDateTime(item.sourceUpdatedAt) : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function SyncRunsTable({
  runs,
  onErrorClick,
}: {
  runs: AdminMasterDataSyncRun[];
  onErrorClick: (run: AdminMasterDataSyncRun, anchor: HTMLElement) => void;
}) {
  if (runs.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
        Senkron koşu geçmişi bulunamadı.
      </Typography>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small" aria-label="Senkron koşu geçmişi">
        <TableHead>
          <TableRow>
            <TableCell>Başlangıç</TableCell>
            <TableCell>Durum</TableCell>
            <TableCell>Süre</TableCell>
            <TableCell align="right">Kayıt</TableCell>
            <TableCell align="right">Hata</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {runs.map((run) => {
            const isFailed = run.status === 'FAILED';

            return (
              <TableRow
                key={run.id}
                hover={isFailed}
                sx={
                  isFailed
                    ? { bgcolor: 'error.50', cursor: run.errorDetailMasked ? 'pointer' : 'default' }
                    : undefined
                }
                onClick={(event) => {
                  if (isFailed && run.errorDetailMasked) {
                    onErrorClick(run, event.currentTarget);
                  }
                }}
              >
                <TableCell>{formatCaseDateTime(run.startedAt)}</TableCell>
                <TableCell>
                  <Chip
                    label={MASTER_DATA_SYNC_STATUS_LABELS[run.status]}
                    size="small"
                    color={getMasterDataSyncStatusColor(run.status)}
                  />
                </TableCell>
                <TableCell>{formatSyncDuration(run.startedAt, run.finishedAt)}</TableCell>
                <TableCell align="right">{run.recordCount}</TableCell>
                <TableCell align="right">{run.errorCount}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export function AdminMasterDataPage() {
  const [activeTab, setActiveTab] = useState<MasterDataTab>(MasterDataType.COMPANY);
  const [errorAnchor, setErrorAnchor] = useState<HTMLElement | null>(null);
  const [selectedErrorRun, setSelectedErrorRun] = useState<AdminMasterDataSyncRun | null>(null);

  const syncRunsQuery = useAdminMasterDataSyncRunsQuery();
  const companiesQuery = useAdminMasterDataCompaniesQuery();
  const locationsQuery = useAdminMasterDataLocationsQuery();
  const functionsQuery = useAdminMasterDataFunctionsQuery();

  const syncRuns = syncRunsQuery.data ?? [];
  const latestRun = syncRuns[0] ?? null;

  const activeQuery =
    activeTab === MasterDataType.COMPANY
      ? companiesQuery
      : activeTab === MasterDataType.LOCATION
        ? locationsQuery
        : functionsQuery;

  const activeItems = activeQuery.data ?? [];
  const isLoading = syncRunsQuery.isLoading || activeQuery.isLoading;
  const isError = syncRunsQuery.isError || activeQuery.isError;
  const errorMessage = syncRunsQuery.error
    ? getAdminErrorMessage(syncRunsQuery.error)
    : activeQuery.error
      ? getAdminErrorMessage(activeQuery.error)
      : 'Veri yüklenemedi.';

  const handleRefresh = () => {
    void Promise.all([
      syncRunsQuery.refetch(),
      companiesQuery.refetch(),
      locationsQuery.refetch(),
      functionsQuery.refetch(),
    ]);
  };

  const handleErrorClick = (run: AdminMasterDataSyncRun, anchor: HTMLElement) => {
    setSelectedErrorRun(run);
    setErrorAnchor(anchor);
  };

  const handleCloseErrorPopover = () => {
    setErrorAnchor(null);
    setSelectedErrorRun(null);
  };

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <AdminPageHeader
          title="Master Data Senkron"
          description="HR/SAP master data senkronizasyon durumu. Salt okunur metadata — düzenleme yapılmaz."
        />
        <Button
          variant="outlined"
          size="small"
          startIcon={<RefreshOutlinedIcon />}
          onClick={handleRefresh}
          disabled={syncRunsQuery.isFetching || activeQuery.isFetching}
        >
          Yenile
        </Button>
      </Stack>

      {isError ? (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={handleRefresh}>
              Tekrar Dene
            </Button>
          }
        >
          {errorMessage}
        </Alert>
      ) : null}

      {isLoading ? (
        <Skeleton variant="rounded" height={120} />
      ) : (
        <SyncSummaryCard latestRun={latestRun} />
      )}

      <Box>
        <Tabs
          value={activeTab}
          onChange={(_event, value: MasterDataTab) => {
            setActiveTab(value);
          }}
          aria-label="Master data sekmeleri"
        >
          {(Object.keys(MASTER_DATA_TAB_LABELS) as MasterDataTab[]).map((tab) => (
            <Tab key={tab} value={tab} label={MASTER_DATA_TAB_LABELS[tab]} />
          ))}
        </Tabs>

        <Box sx={{ pt: 2 }}>
          {activeQuery.isLoading ? (
            <Skeleton variant="rounded" height={240} />
          ) : (
            <MasterDataTable
              items={activeItems}
              showCompany={activeTab !== MasterDataType.COMPANY}
            />
          )}
        </Box>
      </Box>

      <Box>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Senkron Koşu Geçmişi
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Son 30 koşu. Hata satırlarına tıklayarak maskeli hata detayını görüntüleyebilirsiniz.
        </Typography>
        {syncRunsQuery.isLoading ? (
          <Skeleton variant="rounded" height={200} />
        ) : (
          <SyncRunsTable runs={syncRuns} onErrorClick={handleErrorClick} />
        )}
      </Box>

      <Popover
        open={Boolean(errorAnchor && selectedErrorRun)}
        anchorEl={errorAnchor}
        onClose={handleCloseErrorPopover}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 2, maxWidth: 360 }}>
          <Typography variant="subtitle2" gutterBottom>
            Hata Detayı (maskeli)
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {selectedErrorRun?.errorDetailMasked ?? 'Detay bulunamadı.'}
          </Typography>
        </Box>
      </Popover>
    </Stack>
  );
}

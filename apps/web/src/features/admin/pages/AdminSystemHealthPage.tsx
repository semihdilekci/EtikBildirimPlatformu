import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  Grid2 as Grid,
  Paper,
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

import { AdminPageHeader } from '@/features/admin/components/AdminPageHeader';
import {
  getComponentStatusColor,
  getWorkerStatusColor,
  SYSTEM_HEALTH_COMPONENT_LABELS,
  SYSTEM_HEALTH_WORKER_LABELS,
} from '@/features/admin/constants/monitoring-labels';
import { useAdminSystemHealthQuery } from '@/features/admin/hooks/useAdminMonitoring';
import { getAdminErrorMessage } from '@/features/admin/utils/admin-error.util';
import { formatCaseDateTime } from '@/features/cases/utils/case-format.util';

function ComponentStatusCard({ name, status }: { name: string; status: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="body2" fontWeight={600}>
          {SYSTEM_HEALTH_COMPONENT_LABELS[name] ?? name}
        </Typography>
        <Chip label={status} size="small" color={getComponentStatusColor(status)} />
      </Stack>
    </Paper>
  );
}

export function AdminSystemHealthPage() {
  const healthQuery = useAdminSystemHealthQuery();
  const data = healthQuery.data;

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <AdminPageHeader
          title="Sistem Sağlığı"
          description="Worker, outbox kuyruğu ve altyapı bileşenlerinin durumu. İçerik veya PII gösterilmez."
        />
        <Button
          variant="outlined"
          size="small"
          startIcon={<RefreshOutlinedIcon />}
          onClick={() => void healthQuery.refetch()}
          disabled={healthQuery.isFetching}
        >
          Yenile
        </Button>
      </Stack>

      {healthQuery.isError ? (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => void healthQuery.refetch()}>
              Tekrar Dene
            </Button>
          }
        >
          {getAdminErrorMessage(healthQuery.error)}
        </Alert>
      ) : null}

      {healthQuery.isLoading ? (
        <Grid container spacing={2}>
          {Array.from({ length: 3 }).map((_, index) => (
            <Grid key={`comp-skel-${String(index)}`} size={{ xs: 12, sm: 4 }}>
              <Skeleton variant="rounded" height={64} />
            </Grid>
          ))}
        </Grid>
      ) : data ? (
        <>
          <Box>
            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              Son kontrol: {formatCaseDateTime(data.checkedAt)} · Otomatik yenileme: 30 sn
            </Typography>
            <Grid container spacing={2}>
              {data.components.map((component) => (
                <Grid key={component.name} size={{ xs: 12, sm: 4 }}>
                  <ComponentStatusCard name={component.name} status={component.status} />
                </Grid>
              ))}
            </Grid>
          </Box>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Outbox Kuyruk Derinliği
                </Typography>
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">Audit bekleyen</Typography>
                    <Chip label={data.outboxDepth.auditPending} size="small" />
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">Audit hatalı</Typography>
                    <Chip
                      label={data.outboxDepth.auditFailed}
                      size="small"
                      color={data.outboxDepth.auditFailed > 0 ? 'error' : 'default'}
                    />
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">Bildirim bekleyen</Typography>
                    <Chip label={data.outboxDepth.notificationPending} size="small" />
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">Bildirim hatalı</Typography>
                    <Chip
                      label={data.outboxDepth.notificationFailed}
                      size="small"
                      color={data.outboxDepth.notificationFailed > 0 ? 'error' : 'default'}
                    />
                  </Stack>
                </Stack>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  HR/SAP Senkron
                </Typography>
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">Durum</Typography>
                    <Chip label={data.syncStatus.hrSapStatus} size="small" />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Son senkron:{' '}
                    {data.syncStatus.hrSapLastSync
                      ? formatCaseDateTime(data.syncStatus.hrSapLastSync)
                      : '—'}
                  </Typography>
                </Stack>
              </Paper>
            </Grid>
          </Grid>

          <TableContainer component={Paper} variant="outlined">
            <Table size="small" aria-label="Worker durumu tablosu">
              <TableHead>
                <TableRow>
                  <TableCell scope="col">Worker</TableCell>
                  <TableCell scope="col">Durum</TableCell>
                  <TableCell scope="col">Son Çalışma</TableCell>
                  <TableCell scope="col" align="right">
                    Bekleyen
                  </TableCell>
                  <TableCell scope="col" align="right">
                    Hata (24s)
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.workers.map((worker) => (
                  <TableRow
                    key={worker.name}
                    sx={{
                      bgcolor: worker.failedCount > 0 ? 'error.50' : undefined,
                    }}
                  >
                    <TableCell>{SYSTEM_HEALTH_WORKER_LABELS[worker.name] ?? worker.name}</TableCell>
                    <TableCell>
                      <Chip
                        label={worker.status}
                        size="small"
                        color={getWorkerStatusColor(worker.status)}
                      />
                    </TableCell>
                    <TableCell>
                      {worker.lastRunAt ? formatCaseDateTime(worker.lastRunAt) : '—'}
                    </TableCell>
                    <TableCell align="right">{worker.pendingCount}</TableCell>
                    <TableCell align="right">
                      <Typography
                        component="span"
                        color={worker.failedCount > 0 ? 'error.main' : 'text.primary'}
                        fontWeight={worker.failedCount > 0 ? 600 : 400}
                      >
                        {worker.failedCount}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      ) : null}
    </Stack>
  );
}

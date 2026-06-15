import {
  Alert,
  Badge,
  Box,
  Button,
  CircularProgress,
  Link,
  Paper,
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
import { PermissionCode } from '@ethics/policy';
import type { TaskStatusCode, ApprovalWorkItemStatusCode } from '@ethics/shared';
import type { UnifiedWorkItemListItem } from '@ethics/dto';
import type { SyntheticEvent } from 'react';
import { useRef } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

import { PermissionGate } from '@/features/auth/components/PermissionGate';
import { formatCaseDateTime, formatShortCaseId } from '@/features/cases/utils/case-format.util';
import { ApprovalStatusBadge } from '@/features/tasks/components/ApprovalStatusBadge';
import { TaskFilters } from '@/features/tasks/components/TaskFilters';
import { TaskSlaIndicator } from '@/features/tasks/components/TaskSlaIndicator';
import { TaskStatusBadge } from '@/features/tasks/components/TaskStatusBadge';
import { WorkItemKindBadge } from '@/features/tasks/components/WorkItemKindBadge';
import { useTaskListTab } from '@/features/tasks/hooks/useTaskListTab';
import { useTasksListQuery } from '@/features/tasks/hooks/useTasks';
import { getTaskErrorMessage } from '@/features/tasks/utils/task-error.util';

function getTypeLabel(task: UnifiedWorkItemListItem): string {
  return task.kind === 'APPROVAL' ? task.approvalCategoryLabel : task.taskTypeLabel;
}

function getDueOrRequestedLabel(task: UnifiedWorkItemListItem): string {
  if (task.kind === 'APPROVAL') {
    return formatCaseDateTime(task.requestedAt);
  }

  return task.dueAt ? formatCaseDateTime(task.dueAt) : '—';
}

export function TaskListPage() {
  const navigate = useNavigate();
  const cursorHistoryRef = useRef<string[]>([]);
  const {
    activeTab,
    tabLabels,
    kind,
    listQuery,
    pendingCountQuery,
    setActiveTab,
    setCursor,
    setKind,
    clearFilters,
    hasActiveFilters,
  } = useTaskListTab();

  const tasksQuery = useTasksListQuery(listQuery);
  const pendingCountQueryResult = useTasksListQuery(pendingCountQuery);

  const handleTabChange = (_event: SyntheticEvent, nextTab: typeof activeTab) => {
    cursorHistoryRef.current = [];
    setActiveTab(nextTab);
  };

  const handleNextPage = () => {
    const nextCursor = tasksQuery.data?.pagination.nextCursor;
    if (!nextCursor) {
      return;
    }

    if (listQuery.cursor) {
      cursorHistoryRef.current.push(listQuery.cursor);
    } else {
      cursorHistoryRef.current.push('');
    }

    setCursor(nextCursor);
  };

  const handlePreviousPage = () => {
    const previousCursor = cursorHistoryRef.current.pop();
    setCursor(previousCursor && previousCursor.length > 0 ? previousCursor : null);
  };

  const pendingCount = pendingCountQueryResult.data?.data.length ?? 0;
  const pendingHasMore = pendingCountQueryResult.data?.pagination.hasMore ?? false;
  const pendingBadgeLabel = pendingHasMore ? `${String(pendingCount)}+` : String(pendingCount);

  const isInitialLoading = tasksQuery.isPending && !tasksQuery.data;
  const isFetching = tasksQuery.isFetching && !tasksQuery.isPending;
  const isEmptyWithFilters =
    !isInitialLoading && tasksQuery.data?.data.length === 0 && hasActiveFilters;

  return (
    <PermissionGate
      permission={PermissionCode.TASK_LIST}
      fallback={
        <Alert severity="warning" role="alert">
          Görev listesini görüntüleme yetkiniz bulunmuyor.
        </Alert>
      }
    >
      <Stack spacing={3}>
        <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap">
          <Typography variant="h5" component="h1">
            Görevlerim
          </Typography>
          {pendingCountQueryResult.data ? (
            <Badge
              badgeContent={pendingBadgeLabel}
              color="primary"
              aria-label={`${pendingBadgeLabel} bekleyen görev`}
            >
              <Typography variant="body2" color="text.secondary" sx={{ pr: 2 }}>
                Bekleyen
              </Typography>
            </Badge>
          ) : null}
        </Stack>

        <TaskFilters
          kind={kind}
          onKindChange={setKind}
          onClearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters}
        />

        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          aria-label="Görev durumu sekmeleri"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab value="pending" label={tabLabels.pending} />
          <Tab value="in_progress" label={tabLabels.in_progress} />
          <Tab value="completed" label={tabLabels.completed} />
        </Tabs>

        {tasksQuery.isError ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={() => void tasksQuery.refetch()}>
                Tekrar Dene
              </Button>
            }
          >
            {getTaskErrorMessage(tasksQuery.error, 'Görev listesi yüklenemedi.')}
          </Alert>
        ) : null}

        <TableContainer component={Paper} variant="outlined" sx={{ position: 'relative' }}>
          {isFetching ? (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                bgcolor: 'rgba(255,255,255,0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1,
              }}
            >
              <CircularProgress size={28} aria-label="Görevler yükleniyor" />
            </Box>
          ) : null}

          <Table size="small" aria-label="Görev listesi">
            <TableHead>
              <TableRow>
                <TableCell scope="col">Tür</TableCell>
                <TableCell scope="col">Görev / Onay Tipi</TableCell>
                <TableCell scope="col">İlişkili Vaka</TableCell>
                <TableCell scope="col">Durum</TableCell>
                <TableCell scope="col">SLA</TableCell>
                <TableCell scope="col">Son Tarih / Talep Tarihi</TableCell>
                <TableCell scope="col">Oluşturma</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isInitialLoading
                ? Array.from({ length: 8 }).map((_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: 7 }).map((__, cellIndex) => (
                        <TableCell key={cellIndex}>
                          <Skeleton variant="text" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : null}

              {!isInitialLoading && tasksQuery.data?.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Stack spacing={1} alignItems="flex-start" sx={{ py: 3 }}>
                      <Typography variant="body1">
                        {isEmptyWithFilters
                          ? 'Filtre kriterlerine uygun görev bulunamadı.'
                          : activeTab === 'pending'
                            ? 'Bekleyen göreviniz bulunmuyor.'
                            : activeTab === 'in_progress'
                              ? 'Devam eden göreviniz bulunmuyor.'
                              : 'Tamamlanan görev bulunmuyor.'}
                      </Typography>
                      {isEmptyWithFilters ? (
                        <Button variant="text" onClick={clearFilters}>
                          Filtreleri Temizle
                        </Button>
                      ) : null}
                    </Stack>
                  </TableCell>
                </TableRow>
              ) : null}

              {tasksQuery.data?.data.map((task) => (
                <TableRow
                  key={task.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => {
                    void navigate(`/app/tasks/${task.id}`);
                  }}
                >
                  <TableCell>
                    <WorkItemKindBadge kind={task.kind} />
                  </TableCell>
                  <TableCell>{getTypeLabel(task)}</TableCell>
                  <TableCell>
                    {task.kind === 'WORKFLOW' ? (
                      <Link
                        component={RouterLink}
                        to={`/app/cases/${task.caseId}`}
                        onClick={(event) => {
                          event.stopPropagation();
                        }}
                      >
                        {formatShortCaseId(task.caseId)}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    {task.kind === 'APPROVAL' ? (
                      <ApprovalStatusBadge status={task.status as ApprovalWorkItemStatusCode} />
                    ) : (
                      <TaskStatusBadge status={task.status as TaskStatusCode} />
                    )}
                  </TableCell>
                  <TableCell>
                    {task.kind === 'WORKFLOW' ? (
                      <TaskSlaIndicator
                        dueAt={task.dueAt}
                        createdAt={task.createdAt}
                        slaStatus={task.slaStatus}
                        status={task.status}
                      />
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>{getDueOrRequestedLabel(task)}</TableCell>
                  <TableCell>{formatCaseDateTime(task.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Stack direction="row" justifyContent="space-between">
          <Button
            variant="outlined"
            disabled={cursorHistoryRef.current.length === 0 || tasksQuery.isFetching}
            onClick={handlePreviousPage}
          >
            Önceki Sayfa
          </Button>
          <Button
            variant="outlined"
            disabled={!tasksQuery.data?.pagination.hasMore || tasksQuery.isFetching}
            onClick={handleNextPage}
          >
            Sonraki Sayfa
          </Button>
        </Stack>
      </Stack>
    </PermissionGate>
  );
}

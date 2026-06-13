import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Grid2 as Grid,
  Link,
  Skeleton,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import { PermissionCode } from '@ethics/policy';
import { TaskType, type CaseStateCode, type TaskStatusCode } from '@ethics/shared';
import { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';

import { PermissionGate } from '@/features/auth/components/PermissionGate';
import { CaseStateBadge } from '@/features/cases/components/CaseStateBadge';
import { formatCaseDateTime, formatShortCaseId } from '@/features/cases/utils/case-format.util';
import { CompleteTaskDialog } from '@/features/tasks/components/CompleteTaskDialog';
import { DelegateTaskDialog } from '@/features/tasks/components/DelegateTaskDialog';
import { TaskSlaIndicator } from '@/features/tasks/components/TaskSlaIndicator';
import { TaskStatusBadge } from '@/features/tasks/components/TaskStatusBadge';
import {
  useCompleteTaskMutation,
  useDelegateTaskMutation,
  useTaskDetailQuery,
} from '@/features/tasks/hooks/useTasks';
import { canCompleteTask, canDelegateTask } from '@/features/tasks/utils/task-action.util';
import { getTaskErrorMessage, isTaskForbiddenError } from '@/features/tasks/utils/task-error.util';
import { useAuthStore } from '@/stores/useAuthStore';

export function TaskDetailPage() {
  const { id: taskId = '' } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showDelegateDialog, setShowDelegateDialog] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastSeverity, setToastSeverity] = useState<'success' | 'error'>('success');

  const taskDetailQuery = useTaskDetailQuery(taskId);
  const completeMutation = useCompleteTaskMutation(taskId, taskDetailQuery.data?.caseId ?? '');
  const delegateMutation = useDelegateTaskMutation(taskId, taskDetailQuery.data?.caseId ?? '');

  useEffect(() => {
    if (taskDetailQuery.isError && isTaskForbiddenError(taskDetailQuery.error)) {
      void navigate('/403', { replace: true });
    }
  }, [taskDetailQuery.error, taskDetailQuery.isError, navigate]);

  const handleComplete = async (body: Parameters<typeof completeMutation.mutateAsync>[0]) => {
    try {
      await completeMutation.mutateAsync(body);
      setShowCompleteDialog(false);
      setToastSeverity('success');
      setToastMessage('Görev başarıyla tamamlandı.');
    } catch (error) {
      setToastSeverity('error');
      setToastMessage(getTaskErrorMessage(error, 'Görev tamamlanamadı.'));
      await taskDetailQuery.refetch();
    }
  };

  const handleDelegate = async (body: Parameters<typeof delegateMutation.mutateAsync>[0]) => {
    try {
      await delegateMutation.mutateAsync(body);
      setShowDelegateDialog(false);
      setToastSeverity('success');
      setToastMessage('Görev başarıyla devredildi.');
    } catch (error) {
      setToastSeverity('error');
      setToastMessage(getTaskErrorMessage(error, 'Devir işlemi başarısız.'));
      await taskDetailQuery.refetch();
    }
  };

  if (taskDetailQuery.isPending) {
    return (
      <Stack spacing={3}>
        <Skeleton variant="rounded" height={48} width="40%" />
        <Skeleton variant="rounded" height={200} />
        <Skeleton variant="rounded" height={48} width="60%" />
      </Stack>
    );
  }

  if (taskDetailQuery.isError) {
    if (isTaskForbiddenError(taskDetailQuery.error)) {
      return null;
    }

    return (
      <Stack spacing={2} alignItems="flex-start">
        <Alert severity="error" role="alert">
          {getTaskErrorMessage(taskDetailQuery.error, 'Görev bulunamadı veya erişim yetkiniz yok.')}
        </Alert>
        <Button component={RouterLink} to="/app/tasks" startIcon={<ArrowBackOutlinedIcon />}>
          Görevlere Dön
        </Button>
      </Stack>
    );
  }

  const task = taskDetailQuery.data;
  const showComplete =
    canCompleteTask(task, user) && task.taskType !== TaskType.MEMBER_APPROVAL_TASK;
  const showDelegate = canDelegateTask(task, user);

  return (
    <Stack spacing={3}>
      <Button
        component={RouterLink}
        to="/app/tasks"
        startIcon={<ArrowBackOutlinedIcon />}
        sx={{ alignSelf: 'flex-start' }}
      >
        Görevlerim
      </Button>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'center' }}
        spacing={2}
      >
        <Stack spacing={1}>
          <Typography variant="h5" component="h1">
            {task.taskTypeLabel}
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
            <TaskStatusBadge status={task.status as TaskStatusCode} />
            <TaskSlaIndicator
              dueAt={task.dueAt}
              createdAt={task.createdAt}
              slaStatus={task.slaStatus}
              status={task.status}
              size="medium"
            />
          </Stack>
        </Stack>
      </Stack>

      {task.taskType === TaskType.MEMBER_APPROVAL_TASK ? (
        <Alert severity="info">
          Bu görev oy verme ile tamamlanır. Lütfen{' '}
          <Link component={RouterLink} to={`/app/cases/${task.caseId}`}>
            vaka detayı
          </Link>{' '}
          ekranından onay veya itiraz oyunuzu kullanın.
        </Alert>
      ) : null}

      <Card variant="outlined">
        <CardContent>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="caption" color="text.secondary">
                İlişkili Vaka
              </Typography>
              <Typography variant="body1">
                <Link component={RouterLink} to={`/app/cases/${task.caseId}`}>
                  {formatShortCaseId(task.caseId)}
                </Link>
                {' — '}
                <CaseStateBadge
                  state={task.case.currentState as CaseStateCode}
                  label={task.case.currentStateLabel}
                />
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="caption" color="text.secondary">
                Şirket
              </Typography>
              <Typography variant="body1">{task.case.companyName}</Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="caption" color="text.secondary">
                Atanan Rol
              </Typography>
              <Typography variant="body1">{task.assignedRole}</Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="caption" color="text.secondary">
                Oluşturma Tarihi
              </Typography>
              <Typography variant="body1">{formatCaseDateTime(task.createdAt)}</Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="caption" color="text.secondary">
                Son Tarih (SLA)
              </Typography>
              <Typography variant="body1">
                {task.dueAt ? formatCaseDateTime(task.dueAt) : '—'}
              </Typography>
            </Grid>
            {task.delegatedFromTaskId ? (
              <Grid size={{ xs: 12 }}>
                <Typography variant="caption" color="text.secondary">
                  Devir Bilgisi
                </Typography>
                <Typography variant="body1">
                  Önceki görev: {formatShortCaseId(task.delegatedFromTaskId)}
                </Typography>
              </Grid>
            ) : null}
            {task.outcome ? (
              <Grid size={{ xs: 12 }}>
                <Typography variant="caption" color="text.secondary">
                  Sonuç Notu
                </Typography>
                <Typography variant="body1">{task.outcome}</Typography>
              </Grid>
            ) : null}
            {task.completedAt ? (
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="caption" color="text.secondary">
                  Tamamlanma Tarihi
                </Typography>
                <Typography variant="body1">{formatCaseDateTime(task.completedAt)}</Typography>
              </Grid>
            ) : null}
          </Grid>
        </CardContent>
      </Card>

      <Stack direction="row" spacing={2} flexWrap="wrap">
        <Button component={RouterLink} to={`/app/cases/${task.caseId}`} variant="outlined">
          Vakaya Git
        </Button>

        <PermissionGate permission={PermissionCode.TASK_COMPLETE}>
          {showComplete ? (
            <Button
              variant="contained"
              onClick={() => {
                setShowCompleteDialog(true);
              }}
            >
              Görevi Tamamla
            </Button>
          ) : null}
        </PermissionGate>

        <PermissionGate permission={PermissionCode.TASK_DELEGATE}>
          {showDelegate ? (
            <Button
              variant="outlined"
              onClick={() => {
                setShowDelegateDialog(true);
              }}
            >
              Devret
            </Button>
          ) : null}
        </PermissionGate>
      </Stack>

      <CompleteTaskDialog
        open={showCompleteDialog}
        isSubmitting={completeMutation.isPending}
        onClose={() => {
          setShowCompleteDialog(false);
        }}
        onConfirm={handleComplete}
      />

      <DelegateTaskDialog
        open={showDelegateDialog}
        isSubmitting={delegateMutation.isPending}
        onClose={() => {
          setShowDelegateDialog(false);
        }}
        onConfirm={handleDelegate}
      />

      <Snackbar
        open={Boolean(toastMessage)}
        autoHideDuration={5000}
        onClose={() => {
          setToastMessage(null);
        }}
        message={toastMessage ?? ''}
        slotProps={{
          content: {
            role: toastSeverity === 'error' ? 'alert' : 'status',
            sx: {
              bgcolor: toastSeverity === 'error' ? 'error.main' : 'success.main',
              color: 'common.white',
            },
          },
        }}
      />
    </Stack>
  );
}

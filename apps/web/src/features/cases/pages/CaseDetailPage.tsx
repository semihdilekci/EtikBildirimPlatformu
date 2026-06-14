import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Skeleton,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import type { CaseStateCode, ClearanceLevelCode, WorkflowCommandCode } from '@ethics/shared';
import { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';

import { CaseActionBar } from '@/features/cases/components/CaseActionBar';
import { CaseDocumentsTab } from '@/features/documents/components/CaseDocumentsTab';
import { CaseStateBadge } from '@/features/cases/components/CaseStateBadge';
import { CaseSummaryTab } from '@/features/cases/components/CaseSummaryTab';
import { CaseTimeline } from '@/features/cases/components/CaseTimeline';
import { ConfidentialityBadge } from '@/features/cases/components/ConfidentialityBadge';
import { TransitionDialog } from '@/features/cases/components/TransitionDialog';
import {
  useCaseDetailQuery,
  useCaseTransitionsQuery,
  useCreateCaseTransitionMutation,
} from '@/features/cases/hooks/useCases';
import {
  getCaseErrorMessage,
  isCaseForbiddenError,
  isCaseInvalidTransitionError,
  isCaseOptimisticLockError,
} from '@/features/cases/utils/case-error.util';
import { formatShortCaseId } from '@/features/cases/utils/case-format.util';

type DetailTab = 'summary' | 'timeline' | 'documents' | 'votes' | 'messages';

export function CaseDetailPage() {
  const { id: caseId = '' } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<DetailTab>('summary');
  const [selectedCommand, setSelectedCommand] = useState<WorkflowCommandCode | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastSeverity, setToastSeverity] = useState<'success' | 'error'>('success');

  const caseDetailQuery = useCaseDetailQuery(caseId);
  const transitionsQuery = useCaseTransitionsQuery(caseId, activeTab === 'timeline');
  const transitionMutation = useCreateCaseTransitionMutation(caseId);

  useEffect(() => {
    if (caseDetailQuery.isError && isCaseForbiddenError(caseDetailQuery.error)) {
      void navigate('/403', { replace: true });
    }
  }, [caseDetailQuery.error, caseDetailQuery.isError, navigate]);

  const handleTransitionConfirm = async (payload: {
    command: WorkflowCommandCode;
    reason?: string;
    idempotencyKey: string;
    metadata: Record<string, unknown>;
  }) => {
    try {
      await transitionMutation.mutateAsync({
        command: payload.command,
        reason: payload.reason,
        idempotencyKey: payload.idempotencyKey,
        metadata: payload.metadata,
      });
      setSelectedCommand(null);
      setToastSeverity('success');
      setToastMessage('İşlem başarıyla tamamlandı.');
    } catch (error) {
      if (isCaseOptimisticLockError(error) || isCaseInvalidTransitionError(error)) {
        await caseDetailQuery.refetch();
      }

      setToastSeverity('error');
      setToastMessage(getCaseErrorMessage(error));
    }
  };

  if (caseDetailQuery.isPending) {
    return (
      <Stack spacing={3}>
        <Skeleton variant="rounded" height={72} />
        <Skeleton variant="rounded" height={48} width="60%" />
        <Skeleton variant="rounded" height={240} />
      </Stack>
    );
  }

  if (caseDetailQuery.isError) {
    if (isCaseForbiddenError(caseDetailQuery.error)) {
      return null;
    }

    return (
      <Stack spacing={2} alignItems="flex-start">
        <Alert severity="error" role="alert">
          {getCaseErrorMessage(caseDetailQuery.error, 'Vaka bulunamadı veya erişim yetkiniz yok.')}
        </Alert>
        <Button component={RouterLink} to="/app/cases" startIcon={<ArrowBackOutlinedIcon />}>
          Vakalara Dön
        </Button>
      </Stack>
    );
  }

  const caseDetail = caseDetailQuery.data;
  const isSubmitting = transitionMutation.isPending;

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Button
          component={RouterLink}
          to="/app/cases"
          startIcon={<ArrowBackOutlinedIcon />}
          sx={{ alignSelf: 'flex-start' }}
        >
          Vakalar
        </Button>

        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="h5" component="h1">
            Vaka {formatShortCaseId(caseDetail.id)}
          </Typography>
          <CaseStateBadge
            state={caseDetail.currentState as CaseStateCode}
            label={caseDetail.currentStateLabel}
            size="medium"
          />
          <ConfidentialityBadge
            level={caseDetail.confidentialityLevel as ClearanceLevelCode}
            size="medium"
          />
        </Stack>

        <Typography variant="body2" color="text.secondary">
          {caseDetail.companyName} · {caseDetail.categoryGroup}
        </Typography>
      </Stack>

      <CaseActionBar
        availableActions={caseDetail.availableActions as WorkflowCommandCode[]}
        disabled={isSubmitting}
        onActionClick={setSelectedCommand}
      />

      <Tabs
        value={activeTab}
        onChange={(_event, value: DetailTab) => {
          setActiveTab(value);
        }}
        aria-label="Vaka detay sekmeleri"
      >
        <Tab value="summary" label="Özet" />
        <Tab value="timeline" label="Zaman Çizelgesi" />
        <Tab value="documents" label="Dokümanlar" />
        <Tab value="votes" label="Oylar" disabled />
        <Tab value="messages" label="Güvenli Mesajlar" disabled />
      </Tabs>

      {activeTab === 'summary' ? <CaseSummaryTab caseDetail={caseDetail} /> : null}

      {activeTab === 'timeline' ? (
        <CaseTimeline
          transitions={transitionsQuery.data}
          isLoading={transitionsQuery.isPending}
          isError={transitionsQuery.isError}
          onRetry={() => {
            void transitionsQuery.refetch();
          }}
        />
      ) : null}

      {activeTab === 'documents' ? (
        <CaseDocumentsTab
          caseId={caseId}
          onToast={(message, severity) => {
            setToastSeverity(severity);
            setToastMessage(message);
          }}
        />
      ) : null}

      <TransitionDialog
        open={selectedCommand !== null}
        command={selectedCommand}
        isSubmitting={isSubmitting}
        onClose={() => {
          if (!isSubmitting) {
            setSelectedCommand(null);
          }
        }}
        onConfirm={(payload) => {
          void handleTransitionConfirm(payload);
        }}
      />

      {isSubmitting ? (
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            bgcolor: 'rgba(255,255,255,0.72)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: (theme) => theme.zIndex.modal + 1,
          }}
          role="alert"
          aria-live="polite"
        >
          <CircularProgress sx={{ mb: 2 }} />
          <Typography variant="h6">İşleminiz gerçekleştiriliyor...</Typography>
        </Box>
      ) : null}

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

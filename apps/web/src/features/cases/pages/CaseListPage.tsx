import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
} from '@mui/material';
import { PermissionCode } from '@ethics/policy';
import { ClearanceLevel, type CaseStateCode, type ClearanceLevelCode } from '@ethics/shared';
import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { PermissionGate } from '@/features/auth/components/PermissionGate';
import { useIntakeCompaniesQuery } from '@/features/intake/hooks/useIntakeQueries';
import { CaseFilters } from '@/features/cases/components/CaseFilters';
import { CaseStateBadge } from '@/features/cases/components/CaseStateBadge';
import { ConfidentialityBadge } from '@/features/cases/components/ConfidentialityBadge';
import { useCaseListFilters } from '@/features/cases/hooks/useCaseListFilters';
import { useCasesListQuery } from '@/features/cases/hooks/useCases';
import { formatCaseDateTime, formatShortCaseId } from '@/features/cases/utils/case-format.util';
import { getCaseErrorMessage } from '@/features/cases/utils/case-error.util';
import { useAuthStore } from '@/stores/useAuthStore';

export function CaseListPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const cursorHistoryRef = useRef<string[]>([]);

  const {
    filters,
    uiFilters,
    hasActiveFilters,
    setStatusFilter,
    setCompanyFilter,
    setConfidentialityFilter,
    setDateFromFilter,
    setDateToFilter,
    setAssignedToMeFilter,
    setSort,
    setCursor,
    clearFilters,
  } = useCaseListFilters();

  const casesQuery = useCasesListQuery(filters);
  const companiesQuery = useIntakeCompaniesQuery();

  const handleNextPage = () => {
    const nextCursor = casesQuery.data?.pagination.nextCursor;
    if (!nextCursor) {
      return;
    }

    if (filters.cursor) {
      cursorHistoryRef.current.push(filters.cursor);
    } else {
      cursorHistoryRef.current.push('');
    }

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

  const userClearance = user?.clearanceLevel ?? ClearanceLevel.NORMAL;
  const isInitialLoading = casesQuery.isPending && !casesQuery.data;
  const isFetching = casesQuery.isFetching && !casesQuery.isPending;

  return (
    <PermissionGate
      permission={PermissionCode.CASE_LIST}
      fallback={
        <Alert severity="warning" role="alert">
          Vaka listesini görüntüleme yetkiniz bulunmuyor.
        </Alert>
      }
    >
      <Stack spacing={3}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          flexWrap="wrap"
          gap={2}
        >
          <Typography variant="h5" component="h1">
            Vakalar
          </Typography>
          {casesQuery.data ? (
            <Typography variant="body2" color="text.secondary">
              {casesQuery.data.data.length} kayıt gösteriliyor
            </Typography>
          ) : null}
        </Stack>

        <CaseFilters
          status={uiFilters.status}
          companyId={uiFilters.companyId}
          confidentialityLevel={uiFilters.confidentialityLevel}
          dateFrom={uiFilters.dateFrom}
          dateTo={uiFilters.dateTo}
          assignedToMe={uiFilters.assignedToMe}
          companies={companiesQuery.data ?? []}
          userClearance={userClearance}
          onStatusChange={setStatusFilter}
          onCompanyChange={setCompanyFilter}
          onConfidentialityChange={setConfidentialityFilter}
          onDateFromChange={setDateFromFilter}
          onDateToChange={setDateToFilter}
          onAssignedToMeChange={setAssignedToMeFilter}
          onClearFilters={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
        />

        {casesQuery.isError ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={() => void casesQuery.refetch()}>
                Tekrar Dene
              </Button>
            }
          >
            {getCaseErrorMessage(casesQuery.error, 'Vaka listesi yüklenemedi.')}
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
              <CircularProgress size={28} aria-label="Vakalar yükleniyor" />
            </Box>
          ) : null}

          <Table size="small" aria-label="Vaka listesi">
            <TableHead>
              <TableRow>
                <TableCell scope="col">Vaka No</TableCell>
                <TableCell scope="col">Durum</TableCell>
                <TableCell scope="col">Gizlilik</TableCell>
                <TableCell scope="col">Şirket</TableCell>
                <TableCell scope="col">Kategori</TableCell>
                <TableCell
                  scope="col"
                  sortDirection={uiFilters.sortBy === 'openedAt' ? uiFilters.sortOrder : false}
                >
                  <TableSortLabel
                    active={uiFilters.sortBy === 'openedAt'}
                    direction={uiFilters.sortBy === 'openedAt' ? uiFilters.sortOrder : 'desc'}
                    onClick={() => {
                      setSort('openedAt');
                    }}
                  >
                    Açılış Tarihi
                  </TableSortLabel>
                </TableCell>
                <TableCell
                  scope="col"
                  sortDirection={
                    uiFilters.sortBy === 'lastActivityAt' ? uiFilters.sortOrder : false
                  }
                >
                  <TableSortLabel
                    active={uiFilters.sortBy === 'lastActivityAt'}
                    direction={uiFilters.sortBy === 'lastActivityAt' ? uiFilters.sortOrder : 'desc'}
                    onClick={() => {
                      setSort('lastActivityAt');
                    }}
                  >
                    Son Aktivite
                  </TableSortLabel>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isInitialLoading
                ? Array.from({ length: 10 }).map((_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: 7 }).map((__, cellIndex) => (
                        <TableCell key={cellIndex}>
                          <Skeleton variant="text" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : null}

              {!isInitialLoading && casesQuery.data?.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Stack spacing={1} alignItems="flex-start" sx={{ py: 3 }}>
                      <Typography variant="body1">
                        {hasActiveFilters
                          ? 'Filtre kriterlerine uygun vaka bulunamadı.'
                          : 'Henüz vaka bulunmuyor.'}
                      </Typography>
                      {hasActiveFilters ? (
                        <Button variant="outlined" size="small" onClick={handleClearFilters}>
                          Filtreleri Temizle
                        </Button>
                      ) : null}
                    </Stack>
                  </TableCell>
                </TableRow>
              ) : null}

              {casesQuery.data?.data.map((caseItem) => (
                <TableRow
                  key={caseItem.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => {
                    void navigate(`/app/cases/${caseItem.id}`);
                  }}
                >
                  <TableCell>{formatShortCaseId(caseItem.id)}</TableCell>
                  <TableCell>
                    <CaseStateBadge
                      state={caseItem.currentState as CaseStateCode}
                      label={caseItem.currentStateLabel}
                    />
                  </TableCell>
                  <TableCell>
                    <ConfidentialityBadge
                      level={caseItem.confidentialityLevel as ClearanceLevelCode}
                    />
                  </TableCell>
                  <TableCell>{caseItem.companyName}</TableCell>
                  <TableCell>{caseItem.categoryGroup}</TableCell>
                  <TableCell>{formatCaseDateTime(caseItem.openedAt)}</TableCell>
                  <TableCell>{formatCaseDateTime(caseItem.lastActivityAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Stack direction="row" justifyContent="space-between">
          <Button
            variant="outlined"
            disabled={cursorHistoryRef.current.length === 0 || casesQuery.isFetching}
            onClick={handlePreviousPage}
          >
            Önceki Sayfa
          </Button>
          <Button
            variant="outlined"
            disabled={!casesQuery.data?.pagination.hasMore || casesQuery.isFetching}
            onClick={handleNextPage}
          >
            Sonraki Sayfa
          </Button>
        </Stack>
      </Stack>
    </PermissionGate>
  );
}

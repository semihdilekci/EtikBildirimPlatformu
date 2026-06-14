import {
  Alert,
  Box,
  Button,
  Chip,
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
import type { ClearanceLevelCode } from '@ethics/shared';
import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  AdminUserFilters,
  countPendingRoleApprovals,
  filterUsersWithPendingApprovals,
} from '@/features/admin/components/AdminUserFilters';
import { AdminUserRoleChips } from '@/features/admin/components/AdminUserRoleChips';
import { useAdminUserListFilters } from '@/features/admin/hooks/useAdminUserListFilters';
import { useAdminUsersListQuery } from '@/features/admin/hooks/useAdminUsers';
import { getAdminErrorMessage } from '@/features/admin/utils/admin-error.util';
import { ConfidentialityBadge } from '@/features/cases/components/ConfidentialityBadge';
import { formatCaseDateTime } from '@/features/cases/utils/case-format.util';

export function AdminUserListPage() {
  const navigate = useNavigate();
  const cursorHistoryRef = useRef<string[]>([]);

  const {
    filters,
    uiFilters,
    hasActiveFilters,
    setSearchFilter,
    setCompanyFilter,
    setRoleFilter,
    setIsActiveFilter,
    setPendingOnlyFilter,
    setCursor,
    clearFilters,
  } = useAdminUserListFilters();

  const usersQuery = useAdminUsersListQuery(filters);

  const allUsers = usersQuery.data?.data ?? [];
  const visibleUsers = uiFilters.pendingOnly ? filterUsersWithPendingApprovals(allUsers) : allUsers;
  const pendingCount = countPendingRoleApprovals(allUsers);
  const activeCount = allUsers.filter((user) => user.isActive).length;

  const handleNextPage = () => {
    const nextCursor = usersQuery.data?.pagination.nextCursor;
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

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" component="h1">
          Kullanıcı Yönetimi
        </Typography>
        {!usersQuery.isLoading && !usersQuery.isError ? (
          <Typography variant="body2" color="text.secondary">
            Bu sayfada {String(allUsers.length)} kayıt · {String(activeCount)} aktif kullanıcı
          </Typography>
        ) : null}
      </Box>

      {pendingCount > 0 && !uiFilters.pendingOnly ? (
        <Alert
          severity="warning"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                setPendingOnlyFilter(true);
              }}
            >
              Görüntüle
            </Button>
          }
        >
          {String(pendingCount)} adet rol ataması onay bekliyor (bu sayfadaki kayıtlar).
        </Alert>
      ) : null}

      {uiFilters.pendingOnly ? (
        <Alert
          severity="info"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                setPendingOnlyFilter(false);
              }}
            >
              Filtreyi Kaldır
            </Button>
          }
        >
          Yalnızca onay bekleyen rol ataması olan kullanıcılar gösteriliyor.
        </Alert>
      ) : null}

      <Paper sx={{ p: 2 }}>
        <AdminUserFilters
          search={uiFilters.search}
          companyId={uiFilters.companyId}
          roleCode={uiFilters.roleCode}
          isActive={uiFilters.isActive}
          hasActiveFilters={hasActiveFilters}
          onSearchChange={setSearchFilter}
          onCompanyChange={setCompanyFilter}
          onRoleChange={setRoleFilter}
          onIsActiveChange={setIsActiveFilter}
          onClearFilters={handleClearFilters}
        />
      </Paper>

      {usersQuery.isError ? (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => void usersQuery.refetch()}>
              Tekrar Dene
            </Button>
          }
        >
          {getAdminErrorMessage(usersQuery.error, 'Kullanıcı listesi yüklenemedi.')}
        </Alert>
      ) : null}

      <TableContainer component={Paper}>
        <Table aria-label="Kullanıcı listesi">
          <TableHead>
            <TableRow>
              <TableCell scope="col">Ad Soyad</TableCell>
              <TableCell scope="col">E-posta</TableCell>
              <TableCell scope="col">Şirket</TableCell>
              <TableCell scope="col">Roller</TableCell>
              <TableCell scope="col">Clearance</TableCell>
              <TableCell scope="col">Durum</TableCell>
              <TableCell scope="col">Son Giriş</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {usersQuery.isLoading
              ? Array.from({ length: 10 }).map((_, index) => (
                  <TableRow key={`skeleton-${String(index)}`}>
                    {Array.from({ length: 7 }).map((__, cellIndex) => (
                      <TableCell key={`cell-${String(cellIndex)}`}>
                        <Skeleton />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : null}

            {!usersQuery.isLoading && visibleUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ py: 3, textAlign: 'center' }}
                  >
                    Kullanıcı bulunamadı.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : null}

            {!usersQuery.isLoading
              ? visibleUsers.map((user) => (
                  <TableRow
                    key={user.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => {
                      void navigate(`/app/admin/users/${user.id}`);
                    }}
                  >
                    <TableCell>{user.displayName}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.companyName ?? '—'}</TableCell>
                    <TableCell>
                      <AdminUserRoleChips roles={user.roles} />
                    </TableCell>
                    <TableCell>
                      <ConfidentialityBadge level={user.clearanceLevel as ClearanceLevelCode} />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={user.isActive ? 'Aktif' : 'Pasif'}
                        size="small"
                        color={user.isActive ? 'success' : 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      {user.lastLoginAt ? formatCaseDateTime(user.lastLoginAt) : '—'}
                    </TableCell>
                  </TableRow>
                ))
              : null}
          </TableBody>
        </Table>
      </TableContainer>

      {!usersQuery.isLoading && usersQuery.data?.pagination.hasMore ? (
        <Stack direction="row" spacing={2} justifyContent="flex-end">
          <Button
            variant="outlined"
            disabled={!filters.cursor && cursorHistoryRef.current.length === 0}
            onClick={handlePreviousPage}
          >
            Önceki
          </Button>
          <Button variant="outlined" onClick={handleNextPage}>
            Sonraki
          </Button>
        </Stack>
      ) : null}
    </Stack>
  );
}

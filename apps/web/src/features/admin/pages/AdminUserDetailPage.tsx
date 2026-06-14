import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Link,
  Paper,
  Skeleton,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type { AdminPendingApproval, AdminUserRole } from '@ethics/dto';
import type { ClearanceLevelCode, Role as RoleCode } from '@ethics/shared';
import { Role } from '@ethics/shared';
import { useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';

import { PermissionGate } from '@/features/auth/components/PermissionGate';
import { ConfidentialityBadge } from '@/features/cases/components/ConfidentialityBadge';
import { formatCaseDateTime } from '@/features/cases/utils/case-format.util';
import { ClearanceUpdateDialog } from '@/features/admin/components/ClearanceUpdateDialog';
import { AdminUserRoleStatusBadge } from '@/features/admin/components/AdminUserRoleChips';
import { PendingApprovalDialog } from '@/features/admin/components/PendingApprovalDialog';
import { RevokeRoleDialog } from '@/features/admin/components/RevokeRoleDialog';
import { RoleAssignDialog } from '@/features/admin/components/RoleAssignDialog';
import { getRoleLabel } from '@/features/admin/constants/role-labels';
import {
  useAdminUserDetailQuery,
  useApproveAdminUserClearanceMutation,
  useApproveAdminUserRoleMutation,
  useAssignAdminUserRoleMutation,
  useRevokeAdminUserRoleMutation,
  useUpdateAdminUserClearanceMutation,
} from '@/features/admin/hooks/useAdminUsers';
import {
  getAdminErrorMessage,
  isAdminUserNotFoundError,
} from '@/features/admin/utils/admin-error.util';
import { useAuthStore } from '@/stores/useAuthStore';

type ToastSeverity = 'success' | 'error' | 'info';

export function AdminUserDetailPage() {
  const { id: userId = '' } = useParams();
  const currentUser = useAuthStore((state) => state.user);

  const detailQuery = useAdminUserDetailQuery(userId);
  const assignRoleMutation = useAssignAdminUserRoleMutation(userId);
  const approveRoleMutation = useApproveAdminUserRoleMutation(userId);
  const revokeRoleMutation = useRevokeAdminUserRoleMutation(userId);
  const updateClearanceMutation = useUpdateAdminUserClearanceMutation(userId);
  const approveClearanceMutation = useApproveAdminUserClearanceMutation(userId);

  const [showRoleAssignDialog, setShowRoleAssignDialog] = useState(false);
  const [showClearanceDialog, setShowClearanceDialog] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<AdminUserRole | null>(null);
  const [approvalTarget, setApprovalTarget] = useState<{
    item: AdminPendingApproval;
    mode: 'approve' | 'reject';
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastSeverity, setToastSeverity] = useState<ToastSeverity>('success');

  const showToast = (message: string, severity: ToastSeverity) => {
    setToastMessage(message);
    setToastSeverity(severity);
  };

  const user = detailQuery.data;

  const handleAssignRole = async (body: Parameters<typeof assignRoleMutation.mutateAsync>[0]) => {
    try {
      await assignRoleMutation.mutateAsync(body);
      setShowRoleAssignDialog(false);
      showToast('Rol ataması onay için gönderildi.', 'info');
    } catch (error) {
      showToast(getAdminErrorMessage(error), 'error');
    }
  };

  const handleRevokeRole = async (body: { reason: string }) => {
    if (!revokeTarget) {
      return;
    }

    try {
      await revokeRoleMutation.mutateAsync({ roleId: revokeTarget.id, body });
      setRevokeTarget(null);
      showToast('Rol kaldırıldı.', 'success');
    } catch (error) {
      showToast(getAdminErrorMessage(error), 'error');
    }
  };

  const handleUpdateClearance = async (
    body: Parameters<typeof updateClearanceMutation.mutateAsync>[0],
  ) => {
    try {
      const result = await updateClearanceMutation.mutateAsync(body);
      setShowClearanceDialog(false);
      if (result.status === 'PENDING_APPROVAL') {
        showToast('Clearance değişikliği onay için gönderildi.', 'info');
      } else {
        showToast('Yetki seviyesi güncellendi.', 'success');
      }
    } catch (error) {
      showToast(getAdminErrorMessage(error), 'error');
    }
  };

  const handleApprovalConfirm = async (approved: boolean, reason: string) => {
    if (!approvalTarget) {
      return;
    }

    const { item } = approvalTarget;

    try {
      if (item.type === 'ROLE_ASSIGNMENT') {
        await approveRoleMutation.mutateAsync({
          roleId: item.id,
          body: { approved, reason },
        });
      } else {
        await approveClearanceMutation.mutateAsync({
          requestId: item.id,
          body: { approved, reason },
        });
      }

      setApprovalTarget(null);
      showToast(approved ? 'İşlem onaylandı.' : 'İşlem reddedildi.', approved ? 'success' : 'info');
    } catch (error) {
      showToast(getAdminErrorMessage(error), 'error');
    }
  };

  const canApprove = (requestedBy: string) => currentUser?.id !== requestedBy;

  if (detailQuery.isLoading) {
    return (
      <Stack spacing={3}>
        <Skeleton variant="text" width={240} height={32} />
        <Skeleton variant="rounded" height={160} />
        <Skeleton variant="rounded" height={240} />
      </Stack>
    );
  }

  if (detailQuery.isError || !user) {
    const notFound = detailQuery.error ? isAdminUserNotFoundError(detailQuery.error) : true;

    return (
      <Stack spacing={2} alignItems="flex-start">
        <Typography variant="h5" component="h1">
          {notFound ? 'Kullanıcı bulunamadı.' : 'Kullanıcı detayı yüklenemedi.'}
        </Typography>
        {!notFound ? (
          <Alert severity="error">{getAdminErrorMessage(detailQuery.error)}</Alert>
        ) : null}
        <Button component={RouterLink} to="/app/admin/users" variant="outlined">
          Kullanıcılara Dön
        </Button>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <Breadcrumbs aria-label="breadcrumb">
        <Link component={RouterLink} to="/app/admin/users" underline="hover" color="inherit">
          Kullanıcılar
        </Link>
        <Typography color="text.primary">{user.displayName}</Typography>
      </Breadcrumbs>

      <Card>
        <CardContent>
          <Stack spacing={1}>
            <Typography variant="h5" component="h2">
              {user.displayName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {user.email}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ pt: 1 }}>
              <Chip
                label={user.isActive ? 'Aktif' : 'Pasif'}
                size="small"
                color={user.isActive ? 'success' : 'default'}
              />
              <ConfidentialityBadge level={user.clearanceLevel as ClearanceLevelCode} />
            </Stack>
            <Typography variant="body2">Şirket: {user.companyName ?? '—'}</Typography>
            <Typography variant="body2">Lokasyon: {user.locationName ?? '—'}</Typography>
            <Typography variant="body2">Fonksiyon: {user.functionName ?? '—'}</Typography>
            <Typography variant="body2">Pozisyon: {user.positionCode ?? '—'}</Typography>
            <Typography variant="body2">
              Son giriş: {user.lastLoginAt ? formatCaseDateTime(user.lastLoginAt) : '—'}
            </Typography>
            <Typography variant="body2">
              JIT provisioning: {user.provisionedAt ? formatCaseDateTime(user.provisionedAt) : '—'}
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      <Paper sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6" component="h3">
            Roller
          </Typography>
          <PermissionGate roles={[Role.ADMIN]}>
            <Button
              variant="contained"
              onClick={() => {
                setShowRoleAssignDialog(true);
              }}
            >
              Rol Ata
            </Button>
          </PermissionGate>
        </Stack>

        <TableContainer>
          <Table size="small" aria-label="Kullanıcı rolleri">
            <TableHead>
              <TableRow>
                <TableCell scope="col">Rol</TableCell>
                <TableCell scope="col">Atama Tarihi</TableCell>
                <TableCell scope="col">Atayan</TableCell>
                <TableCell scope="col">Durum</TableCell>
                <TableCell scope="col" align="right">
                  İşlem
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {user.roles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography variant="body2" color="text.secondary">
                      Atanmış rol yok.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                user.roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell>{getRoleLabel(role.roleCode as RoleCode)}</TableCell>
                    <TableCell>{formatCaseDateTime(role.assignedAt)}</TableCell>
                    <TableCell>{role.assignedByDisplayName}</TableCell>
                    <TableCell>
                      <AdminUserRoleStatusBadge status={role.status} />
                    </TableCell>
                    <TableCell align="right">
                      {role.status === 'ACTIVE' ? (
                        <Button
                          color="error"
                          size="small"
                          onClick={() => {
                            setRevokeTarget(role);
                          }}
                        >
                          Kaldır
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
              Clearance Seviyesi
            </Typography>
            <ConfidentialityBadge level={user.clearanceLevel as ClearanceLevelCode} size="medium" />
          </Box>
          <PermissionGate roles={[Role.ADMIN]}>
            <Button
              variant="outlined"
              onClick={() => {
                setShowClearanceDialog(true);
              }}
            >
              Seviye Değiştir
            </Button>
          </PermissionGate>
        </Stack>
      </Paper>

      {user.pendingApprovals.length > 0 ? (
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" component="h3" sx={{ mb: 2 }}>
            Bekleyen Onaylar
          </Typography>
          <TableContainer>
            <Table size="small" aria-label="Bekleyen onaylar">
              <TableHead>
                <TableRow>
                  <TableCell scope="col">İşlem</TableCell>
                  <TableCell scope="col">Talep Eden</TableCell>
                  <TableCell scope="col">Tarih</TableCell>
                  <TableCell scope="col" align="right">
                    İşlem
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {user.pendingApprovals.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.summary}</TableCell>
                    <TableCell>{item.requestedByDisplayName}</TableCell>
                    <TableCell>{formatCaseDateTime(item.requestedAt)}</TableCell>
                    <TableCell align="right">
                      {canApprove(item.requestedBy) ? (
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => {
                              setApprovalTarget({ item, mode: 'approve' });
                            }}
                          >
                            Onayla
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            onClick={() => {
                              setApprovalTarget({ item, mode: 'reject' });
                            }}
                          >
                            Reddet
                          </Button>
                        </Stack>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          Kendi talebinizi onaylayamazsınız
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      ) : null}

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
          HR/SAP Senkron Bilgisi
        </Typography>
        <Typography variant="body2">Kaynak: {user.hrSync.sourceSystem ?? '—'}</Typography>
        <Typography variant="body2">
          Son güncelleme:{' '}
          {user.hrSync.sourceUpdatedAt ? formatCaseDateTime(user.hrSync.sourceUpdatedAt) : '—'}
        </Typography>
        <Typography variant="body2">
          Durum: {user.hrSync.syncStatus === 'SYNCED' ? 'Senkronize' : 'Bilinmiyor'}
        </Typography>
        {user.hrSync.syncStatus === 'UNKNOWN' ? (
          <Alert severity="warning" sx={{ mt: 2 }}>
            HR/SAP senkron bilgisi eksik veya güncel değil. Düzeltme kaynak sistemde yapılmalıdır.
          </Alert>
        ) : null}
      </Paper>

      <RoleAssignDialog
        open={showRoleAssignDialog}
        isSubmitting={assignRoleMutation.isPending}
        onClose={() => {
          setShowRoleAssignDialog(false);
        }}
        onConfirm={handleAssignRole}
      />

      <ClearanceUpdateDialog
        open={showClearanceDialog}
        currentLevel={user.clearanceLevel as ClearanceLevelCode}
        isSubmitting={updateClearanceMutation.isPending}
        onClose={() => {
          setShowClearanceDialog(false);
        }}
        onConfirm={handleUpdateClearance}
      />

      <RevokeRoleDialog
        open={Boolean(revokeTarget)}
        roleCode={revokeTarget ? (revokeTarget.roleCode as RoleCode) : null}
        isSubmitting={revokeRoleMutation.isPending}
        onClose={() => {
          setRevokeTarget(null);
        }}
        onConfirm={handleRevokeRole}
      />

      <PendingApprovalDialog
        open={Boolean(approvalTarget)}
        summary={approvalTarget?.item.summary ?? ''}
        mode={approvalTarget?.mode ?? null}
        isSubmitting={approveRoleMutation.isPending || approveClearanceMutation.isPending}
        onClose={() => {
          setApprovalTarget(null);
        }}
        onConfirm={handleApprovalConfirm}
      />

      {(assignRoleMutation.isPending ||
        revokeRoleMutation.isPending ||
        updateClearanceMutation.isPending ||
        approveRoleMutation.isPending ||
        approveClearanceMutation.isPending) && (
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
      )}

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
              bgcolor:
                toastSeverity === 'error'
                  ? 'error.main'
                  : toastSeverity === 'info'
                    ? 'info.main'
                    : 'success.main',
              color: 'common.white',
            },
          },
        }}
      />
    </Stack>
  );
}

import { Chip, Stack, Typography } from '@mui/material';
import type { AdminUserListItem } from '@ethics/dto';
import type { Role as RoleCode } from '@ethics/shared';

import { getRoleLabel } from '@/features/admin/constants/role-labels';

type AdminUserRoleChipsProps = {
  roles: AdminUserListItem['roles'];
};

function resolveStatusColor(
  status: AdminUserListItem['roles'][number]['status'],
): 'default' | 'warning' | 'success' {
  switch (status) {
    case 'PENDING_APPROVAL':
      return 'warning';
    case 'ACTIVE':
      return 'success';
    default:
      return 'default';
  }
}

export function AdminUserRoleChips({ roles }: AdminUserRoleChipsProps) {
  const activeRoles = roles.filter((role) => role.status !== 'REVOKED');

  if (activeRoles.length === 0) {
    return (
      <Chip label="Rolsüz" size="small" color="warning" variant="outlined" aria-label="Rolsüz" />
    );
  }

  return (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
      {activeRoles.map((role) => (
        <Chip
          key={`${role.roleCode}-${role.status}`}
          label={getRoleLabel(role.roleCode as RoleCode)}
          size="small"
          color={resolveStatusColor(role.status)}
          variant={role.status === 'PENDING_APPROVAL' ? 'outlined' : 'filled'}
          aria-label={`${getRoleLabel(role.roleCode as RoleCode)} — ${role.status}`}
        />
      ))}
    </Stack>
  );
}

export function AdminUserRoleStatusBadge({
  status,
}: {
  status: AdminUserListItem['roles'][number]['status'];
}) {
  const labels = {
    ACTIVE: 'Aktif',
    PENDING_APPROVAL: 'Onay Bekliyor',
    REVOKED: 'İptal Edilmiş',
  } as const;

  return (
    <Typography
      component="span"
      variant="caption"
      sx={{
        px: 1,
        py: 0.25,
        borderRadius: 1,
        bgcolor:
          status === 'PENDING_APPROVAL'
            ? 'warning.light'
            : status === 'ACTIVE'
              ? 'success.light'
              : 'grey.200',
      }}
    >
      {labels[status]}
    </Typography>
  );
}

import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import type { AdminUserListItem } from '@ethics/dto';
import { useEffect, useState } from 'react';

import { ASSIGNABLE_ROLE_OPTIONS } from '@/features/admin/constants/role-labels';
import { useIntakeCompaniesQuery } from '@/features/intake/hooks/useIntakeQueries';

type AdminUserFiltersProps = {
  search: string;
  companyId: string;
  roleCode: string;
  isActive: boolean | undefined;
  hasActiveFilters: boolean;
  onSearchChange: (value: string) => void;
  onCompanyChange: (value: string) => void;
  onRoleChange: (value: string) => void;
  onIsActiveChange: (value: boolean | undefined) => void;
  onClearFilters: () => void;
};

export function AdminUserFilters({
  search,
  companyId,
  roleCode,
  isActive,
  hasActiveFilters,
  onSearchChange,
  onCompanyChange,
  onRoleChange,
  onIsActiveChange,
  onClearFilters,
}: AdminUserFiltersProps) {
  const [searchInput, setSearchInput] = useState(search);
  const companiesQuery = useIntakeCompaniesQuery();

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed.length === 0) {
      if (search.length > 0) {
        const timer = window.setTimeout(() => {
          onSearchChange('');
        }, 300);
        return () => {
          window.clearTimeout(timer);
        };
      }
      return undefined;
    }

    if (trimmed.length < 2) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      onSearchChange(trimmed);
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput, search, onSearchChange]);

  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
      <TextField
        label="E-posta veya ad ara"
        value={searchInput}
        onChange={(event) => {
          setSearchInput(event.target.value);
        }}
        size="small"
        sx={{ minWidth: 220, flex: 1 }}
        helperText={searchInput.trim().length === 1 ? 'En az 2 karakter girin' : undefined}
      />

      <FormControl size="small" sx={{ minWidth: 180 }}>
        <InputLabel id="admin-user-company-filter">Şirket</InputLabel>
        <Select
          labelId="admin-user-company-filter"
          label="Şirket"
          value={companyId}
          onChange={(event) => {
            onCompanyChange(event.target.value);
          }}
        >
          <MenuItem value="">Tümü</MenuItem>
          {(companiesQuery.data ?? []).map((company) => (
            <MenuItem key={company.id} value={company.id}>
              {company.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 180 }}>
        <InputLabel id="admin-user-role-filter">Rol</InputLabel>
        <Select
          labelId="admin-user-role-filter"
          label="Rol"
          value={roleCode}
          onChange={(event) => {
            onRoleChange(event.target.value);
          }}
        >
          <MenuItem value="">Tümü</MenuItem>
          {ASSIGNABLE_ROLE_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={isActive === undefined ? 'all' : isActive ? 'active' : 'inactive'}
          onChange={(_event, value: 'all' | 'active' | 'inactive' | null) => {
            if (value === null || value === 'all') {
              onIsActiveChange(undefined);
              return;
            }
            onIsActiveChange(value === 'active');
          }}
          aria-label="Aktiflik filtresi"
        >
          <ToggleButton value="all">Tümü</ToggleButton>
          <ToggleButton value="active">Aktif</ToggleButton>
          <ToggleButton value="inactive">Pasif</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {hasActiveFilters ? (
        <Button size="small" onClick={onClearFilters}>
          Filtreleri Temizle
        </Button>
      ) : null}
    </Stack>
  );
}

export function countPendingRoleApprovals(users: readonly AdminUserListItem[]): number {
  return users.reduce((count, user) => {
    const pendingRoles = user.roles.filter((role) => role.status === 'PENDING_APPROVAL').length;
    return count + pendingRoles;
  }, 0);
}

export function filterUsersWithPendingApprovals(
  users: readonly AdminUserListItem[],
): AdminUserListItem[] {
  return users.filter((user) => user.roles.some((role) => role.status === 'PENDING_APPROVAL'));
}

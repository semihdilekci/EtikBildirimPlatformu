import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import HealthAndSafetyOutlinedIcon from '@mui/icons-material/HealthAndSafetyOutlined';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import SyncOutlinedIcon from '@mui/icons-material/SyncOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { PermissionCode } from '@ethics/policy';
import type { ReactNode } from 'react';

export interface InternalNavItem {
  label: string;
  path: string;
  icon: ReactNode;
  permission: (typeof PermissionCode)[keyof typeof PermissionCode];
}

export interface AdminNavItem {
  label: string;
  path: string;
  icon: ReactNode;
  permission: (typeof PermissionCode)[keyof typeof PermissionCode];
}

export const internalNavItems: readonly InternalNavItem[] = [
  {
    label: 'Gösterge Paneli',
    path: '/app/dashboard',
    icon: <DashboardOutlinedIcon />,
    permission: PermissionCode.AUTH_SESSION_READ,
  },
  {
    label: 'Vakalar',
    path: '/app/cases',
    icon: <FolderOutlinedIcon />,
    permission: PermissionCode.CASE_LIST,
  },
  {
    label: 'Görevlerim',
    path: '/app/tasks',
    icon: <AssignmentOutlinedIcon />,
    permission: PermissionCode.TASK_LIST,
  },
] as const;

export const adminNavItems: readonly AdminNavItem[] = [
  {
    label: 'Kullanıcılar',
    path: '/app/admin/users',
    icon: <PeopleOutlinedIcon />,
    permission: PermissionCode.ADMIN_MANAGE_ROLES,
  },
  {
    label: 'Master Data Senkron',
    path: '/app/admin/master-data',
    icon: <SyncOutlinedIcon />,
    permission: PermissionCode.ADMIN_VIEW_SYNC_STATUS,
  },
  {
    label: 'Sistem Ayarları',
    path: '/app/admin/settings',
    icon: <SettingsOutlinedIcon />,
    permission: PermissionCode.ADMIN_MANAGE_SETTINGS,
  },
  {
    label: 'Alan Görünürlüğü',
    path: '/app/admin/field-visibility',
    icon: <VisibilityOutlinedIcon />,
    permission: PermissionCode.ADMIN_MANAGE_SETTINGS,
  },
  {
    label: 'Sistem Sağlığı',
    path: '/app/admin/system-health',
    icon: <HealthAndSafetyOutlinedIcon />,
    permission: PermissionCode.ADMIN_VIEW_SYNC_STATUS,
  },
] as const;

export const adminSectionIcon = <AdminPanelSettingsOutlinedIcon />;

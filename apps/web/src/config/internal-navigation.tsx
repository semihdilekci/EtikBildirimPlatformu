import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined';
import HealthAndSafetyOutlinedIcon from '@mui/icons-material/HealthAndSafetyOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import MailOutlineOutlinedIcon from '@mui/icons-material/MailOutlineOutlined';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import PolicyOutlinedIcon from '@mui/icons-material/PolicyOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import SyncOutlinedIcon from '@mui/icons-material/SyncOutlined';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
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
    label: 'Aksiyon Matrisi',
    path: '/app/admin/action-matrix',
    icon: <GavelOutlinedIcon />,
    permission: PermissionCode.ADMIN_MANAGE_SETTINGS,
  },
  {
    label: 'SLA Politikaları',
    path: '/app/admin/sla-policies',
    icon: <TimerOutlinedIcon />,
    permission: PermissionCode.ADMIN_MANAGE_SETTINGS,
  },
  {
    label: 'İş Günü Takvimi',
    path: '/app/admin/business-calendar',
    icon: <CalendarMonthOutlinedIcon />,
    permission: PermissionCode.ADMIN_MANAGE_SETTINGS,
  },
  {
    label: 'Bildirim Şablonları',
    path: '/app/admin/notification-templates',
    icon: <MailOutlineOutlinedIcon />,
    permission: PermissionCode.ADMIN_MANAGE_SETTINGS,
  },
  {
    label: 'KVKK Metinleri',
    path: '/app/admin/kvkk-texts',
    icon: <PolicyOutlinedIcon />,
    permission: PermissionCode.ADMIN_MANAGE_KVKK,
  },
  {
    label: 'Audit Log',
    path: '/app/admin/audit',
    icon: <HistoryOutlinedIcon />,
    permission: PermissionCode.AUDIT_VIEW_METADATA,
  },
  {
    label: 'Doküman Operasyonları',
    path: '/app/admin/document-ops',
    icon: <StorageOutlinedIcon />,
    permission: PermissionCode.ADMIN_VIEW_SYNC_STATUS,
  },
  {
    label: 'Sistem Sağlığı',
    path: '/app/admin/system-health',
    icon: <HealthAndSafetyOutlinedIcon />,
    permission: PermissionCode.ADMIN_VIEW_SYNC_STATUS,
  },
] as const;

export const adminSectionIcon = <AdminPanelSettingsOutlinedIcon />;

import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import MailOutlinedIcon from '@mui/icons-material/MailOutlined';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import type { NotificationListItem } from '@ethics/dto';
import { NotificationTemplateCode } from '@ethics/shared';
import type { ReactElement } from 'react';

const TASK_TEMPLATE_CODES = new Set<string>([
  NotificationTemplateCode.TASK_ASSIGNED,
  NotificationTemplateCode.TASK_COMPLETED,
  NotificationTemplateCode.TASK_DELEGATED,
  NotificationTemplateCode.SLA_WARNING,
  NotificationTemplateCode.SLA_BREACH,
  NotificationTemplateCode.TASK_OVERDUE_REMINDER,
  NotificationTemplateCode.RAPPORTEUR_ASSIGNED,
  NotificationTemplateCode.ACTION_ASSIGNED,
  NotificationTemplateCode.APPROVAL_WORK_ITEM_ASSIGNED,
]);

const MESSAGE_TEMPLATE_CODES = new Set<string>([
  NotificationTemplateCode.SECURE_MESSAGE_RECEIVED,
  NotificationTemplateCode.SECURE_MESSAGE_REPORTER,
]);

const DOCUMENT_TEMPLATE_CODES = new Set<string>([
  NotificationTemplateCode.DOCUMENT_QUARANTINED,
  NotificationTemplateCode.DOCUMENT_REJECTED,
  NotificationTemplateCode.DOCUMENT_SCAN_COMPLETE,
]);

export function getNotificationIcon(notification: NotificationListItem): ReactElement {
  if (TASK_TEMPLATE_CODES.has(notification.templateCode)) {
    return <AssignmentOutlinedIcon fontSize="small" />;
  }

  if (MESSAGE_TEMPLATE_CODES.has(notification.templateCode)) {
    return <MailOutlinedIcon fontSize="small" />;
  }

  if (DOCUMENT_TEMPLATE_CODES.has(notification.templateCode)) {
    return <InsertDriveFileOutlinedIcon fontSize="small" />;
  }

  if (notification.taskId) {
    return <AssignmentOutlinedIcon fontSize="small" />;
  }

  if (notification.caseId) {
    return <FolderOutlinedIcon fontSize="small" />;
  }

  return <NotificationsOutlinedIcon fontSize="small" />;
}

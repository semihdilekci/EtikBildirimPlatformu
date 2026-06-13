import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import type { SvgIconComponent } from '@mui/icons-material';
import { ReportStatus, type ReportStatusCode } from '@ethics/shared';

type StatusVisualConfig = {
  color: 'info' | 'warning' | 'secondary' | 'success';
  icon: SvgIconComponent;
  description: string;
};

export const TRACKING_STATUS_CONFIG: Record<ReportStatusCode, StatusVisualConfig> = {
  [ReportStatus.SUBMITTED]: {
    color: 'info',
    icon: SendOutlinedIcon,
    description:
      'Bildiriminiz başarıyla alındı ve kurul sekretaryası tarafından değerlendirilecektir.',
  },
  [ReportStatus.ACKNOWLEDGED]: {
    color: 'warning',
    icon: MarkEmailReadOutlinedIcon,
    description: 'Bildiriminiz kayıt altına alındı. Süreç yakında başlayacaktır.',
  },
  [ReportStatus.UNDER_REVIEW]: {
    color: 'secondary',
    icon: HourglassEmptyOutlinedIcon,
    description: 'Bildiriminiz kurul sekretaryası tarafından değerlendirilmektedir.',
  },
  [ReportStatus.CLOSED]: {
    color: 'success',
    icon: CheckCircleOutlineIcon,
    description: 'Bildirim süreci tamamlanmıştır.',
  },
};

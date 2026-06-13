import AssignmentLateOutlinedIcon from '@mui/icons-material/AssignmentLateOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import type { SvgIconComponent } from '@mui/icons-material';
import { CaseState, type CaseStateCode } from '@ethics/shared';

type CaseStateVisualConfig = {
  color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  icon: SvgIconComponent;
};

export const CASE_STATE_CONFIG: Readonly<Record<CaseStateCode, CaseStateVisualConfig>> = {
  [CaseState.REPORT_SUBMITTED]: { color: 'info', icon: InboxOutlinedIcon },
  [CaseState.SECRETARIAT_REVIEW]: { color: 'info', icon: HourglassEmptyOutlinedIcon },
  [CaseState.PRE_RESEARCH]: { color: 'info', icon: HourglassEmptyOutlinedIcon },
  [CaseState.CHAIR_GATE]: { color: 'warning', icon: GavelOutlinedIcon },
  [CaseState.NOT_ON_AGENDA_CLOSED]: { color: 'default', icon: LockOutlinedIcon },
  [CaseState.AGENDA_READY]: { color: 'primary', icon: GavelOutlinedIcon },
  [CaseState.RAPPORTEUR_ASSIGNED]: { color: 'primary', icon: AssignmentLateOutlinedIcon },
  [CaseState.RAPPORTEUR_REPORT_SUBMITTED]: { color: 'primary', icon: AssignmentLateOutlinedIcon },
  [CaseState.MEMBER_APPROVAL]: { color: 'warning', icon: HourglassEmptyOutlinedIcon },
  [CaseState.DECISION_DRAFT]: { color: 'warning', icon: GavelOutlinedIcon },
  [CaseState.BOARD_CHAIR_REVIEW]: { color: 'warning', icon: GavelOutlinedIcon },
  [CaseState.BOARD_APPROVED]: { color: 'success', icon: CheckCircleOutlineOutlinedIcon },
  [CaseState.IMPLEMENTATION_LETTER_PREPARED]: { color: 'info', icon: AssignmentLateOutlinedIcon },
  [CaseState.ACTION_ASSIGNED]: { color: 'info', icon: AssignmentLateOutlinedIcon },
  [CaseState.ACTION_RESPONSE_PENDING]: { color: 'warning', icon: HourglassEmptyOutlinedIcon },
  [CaseState.FOLLOW_UP_DECISION]: { color: 'warning', icon: GavelOutlinedIcon },
  [CaseState.CLOSED_ARCHIVED]: { color: 'default', icon: LockOutlinedIcon },
};

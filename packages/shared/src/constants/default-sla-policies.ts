import { Role } from '../enums/role.enum.js';
import { SlaUnit, type SlaUnitCode } from '../enums/sla-unit.enum.js';
import { TaskType, type TaskTypeCode } from '../enums/task-type.enum.js';

export type DefaultSlaPolicyDefinition = {
  taskType: TaskTypeCode;
  slaDuration: number;
  slaUnit: SlaUnitCode;
  warningThresholdHours: number;
  escalationRole: string;
};

/** Docs/01_DOMAIN_MODEL §Task görev tipi kataloğu — varsayılan SLA politikaları */
export const DEFAULT_SLA_POLICIES: readonly DefaultSlaPolicyDefinition[] = [
  {
    taskType: TaskType.SECRETARIAT_REVIEW_TASK,
    slaDuration: 3,
    slaUnit: SlaUnit.BUSINESS_DAYS,
    warningThresholdHours: 24,
    escalationRole: Role.COUNCIL_SECRETARY,
  },
  {
    taskType: TaskType.PRE_RESEARCH_TASK,
    slaDuration: 5,
    slaUnit: SlaUnit.BUSINESS_DAYS,
    warningThresholdHours: 24,
    escalationRole: Role.COUNCIL_SECRETARY,
  },
  {
    taskType: TaskType.CHAIR_GATE_TASK,
    slaDuration: 3,
    slaUnit: SlaUnit.BUSINESS_DAYS,
    warningThresholdHours: 24,
    escalationRole: Role.COUNCIL_CHAIR,
  },
  {
    taskType: TaskType.RAPPORTEUR_ASSIGN_TASK,
    slaDuration: 3,
    slaUnit: SlaUnit.BUSINESS_DAYS,
    warningThresholdHours: 24,
    escalationRole: Role.COUNCIL_SECRETARY,
  },
  {
    taskType: TaskType.RAPPORTEUR_REPORT_TASK,
    slaDuration: 10,
    slaUnit: SlaUnit.BUSINESS_DAYS,
    warningThresholdHours: 48,
    escalationRole: Role.COUNCIL_SECRETARY,
  },
  {
    taskType: TaskType.MEMBER_APPROVAL_TASK,
    slaDuration: 24,
    slaUnit: SlaUnit.CALENDAR_HOURS,
    warningThresholdHours: 4,
    escalationRole: Role.COUNCIL_SECRETARY,
  },
  {
    taskType: TaskType.DECISION_DRAFT_TASK,
    slaDuration: 5,
    slaUnit: SlaUnit.BUSINESS_DAYS,
    warningThresholdHours: 24,
    escalationRole: Role.COUNCIL_SECRETARY,
  },
  {
    taskType: TaskType.BOARD_REVIEW_TASK,
    slaDuration: 5,
    slaUnit: SlaUnit.BUSINESS_DAYS,
    warningThresholdHours: 24,
    escalationRole: Role.BOARD_CHAIR,
  },
  {
    taskType: TaskType.IMPLEMENTATION_LETTER_TASK,
    slaDuration: 3,
    slaUnit: SlaUnit.BUSINESS_DAYS,
    warningThresholdHours: 24,
    escalationRole: Role.COUNCIL_SECRETARY,
  },
  {
    taskType: TaskType.ACTION_RESPONSE_TASK,
    slaDuration: 14,
    slaUnit: SlaUnit.BUSINESS_DAYS,
    warningThresholdHours: 48,
    escalationRole: Role.COUNCIL_SECRETARY,
  },
  {
    taskType: TaskType.FOLLOW_UP_REVIEW_TASK,
    slaDuration: 5,
    slaUnit: SlaUnit.BUSINESS_DAYS,
    warningThresholdHours: 24,
    escalationRole: Role.COUNCIL_SECRETARY,
  },
] as const;

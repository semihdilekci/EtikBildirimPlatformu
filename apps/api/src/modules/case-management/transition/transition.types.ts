import type {
  AuditActorTypeCode,
  CaseStateCode,
  ClearanceLevel,
  Role,
  WorkflowCommandCode,
} from '@ethics/shared';
import type { Case } from '@prisma/client';

export type AssignmentScope = 'rapporteur' | 'action_owner';

export interface TransitionDefinition {
  toState: CaseStateCode;
  requiredRoles?: readonly Role[];
  requiresAssignment?: AssignmentScope;
  requiresReason?: boolean;
  /** Sistem/otomatik geçiş — rol kontrolü atlanır */
  isSystemCommand?: boolean;
  closesCase?: boolean;
}

export type TransitionMap = Partial<
  Record<CaseStateCode, Partial<Record<WorkflowCommandCode, TransitionDefinition>>>
>;

export interface TransitionActor {
  type: AuditActorTypeCode;
  userId?: string;
  roles: readonly Role[];
  clearanceLevel: ClearanceLevel;
}

export interface ExecuteTransitionInput {
  caseId: string;
  command: WorkflowCommandCode;
  actor: TransitionActor;
  idempotencyKey: string;
  correlationId: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface TransitionTaskStub {
  id: string;
  taskType: string;
  assignedRole: string;
}

export interface TransitionResult {
  caseId: string;
  transitionId: string;
  fromState: CaseStateCode;
  toState: CaseStateCode;
  command: WorkflowCommandCode;
  transitionedAt: Date;
  optimisticLockVersion: number;
  idempotentReplay: boolean;
  tasksCreated: TransitionTaskStub[];
}

export interface TransitionValidationContext {
  caseEntity: Case;
  command: WorkflowCommandCode;
  definition: TransitionDefinition;
  actor: TransitionActor;
  reason?: string;
  metadata?: Record<string, unknown>;
  correlationId?: string;
  idempotencyKey?: string;
}

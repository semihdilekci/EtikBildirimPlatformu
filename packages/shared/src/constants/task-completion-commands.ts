import { TaskType, type TaskTypeCode } from '../enums/task-type.enum.js';
import { WorkflowCommand, type WorkflowCommandCode } from '../enums/workflow-command.enum.js';

/**
 * Görev tamamlanınca tetiklenen workflow komutu — birebir eşleme (iter 1).
 * Çoklu komut gerektiren tipler (chair_gate, board_review) metadata/outcome ile genişletilir.
 */
export const TASK_COMPLETION_COMMAND: Readonly<Partial<Record<TaskTypeCode, WorkflowCommandCode>>> =
  {
    [TaskType.SECRETARIAT_REVIEW_TASK]: WorkflowCommand.START_PRE_RESEARCH,
    [TaskType.PRE_RESEARCH_TASK]: WorkflowCommand.SUBMIT_TO_CHAIR_GATE,
    [TaskType.CHAIR_GATE_TASK]: WorkflowCommand.APPROVE_AGENDA,
    [TaskType.RAPPORTEUR_ASSIGN_TASK]: WorkflowCommand.ASSIGN_RAPPORTEUR,
    [TaskType.RAPPORTEUR_REPORT_TASK]: WorkflowCommand.SUBMIT_RAPPORTEUR_REPORT,
    [TaskType.DECISION_DRAFT_TASK]: WorkflowCommand.SUBMIT_TO_BOARD_REVIEW,
    [TaskType.BOARD_REVIEW_TASK]: WorkflowCommand.BOARD_APPROVE,
    [TaskType.IMPLEMENTATION_LETTER_TASK]: WorkflowCommand.PREPARE_IMPLEMENTATION_LETTER,
    [TaskType.ACTION_RESPONSE_TASK]: WorkflowCommand.SUBMIT_ACTION_RESPONSE,
    [TaskType.FOLLOW_UP_REVIEW_TASK]: WorkflowCommand.FOLLOW_UP_CLOSE,
  };

/** Üye onayı görevleri tamamlanmaz — oy API üzerinden (Faz 6 iter 4). */
export const TASK_TYPES_WITHOUT_COMPLETION: readonly TaskTypeCode[] = [
  TaskType.MEMBER_APPROVAL_TASK,
];

export function resolveTaskCompletionCommand(
  taskType: TaskTypeCode,
): WorkflowCommandCode | undefined {
  return TASK_COMPLETION_COMMAND[taskType];
}

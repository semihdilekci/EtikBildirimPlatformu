-- Faz 6 İterasyon 1: merkezi görev tablosu
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "task_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "assigned_role" TEXT NOT NULL,
    "assigned_user_id" TEXT,
    "assigned_company_id" TEXT,
    "assigned_function_id" TEXT,
    "due_at" TIMESTAMP(3),
    "sla_policy_id" TEXT,
    "sla_paused_at" TIMESTAMP(3),
    "sla_pause_reason" TEXT,
    "created_by_transition_id" TEXT NOT NULL,
    "completed_by_user_id" TEXT,
    "completed_at" TIMESTAMP(3),
    "outcome" TEXT,
    "delegated_from_task_id" TEXT,
    "visibility_policy_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_case_id_fkey"
    FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_transition_id_fkey"
    FOREIGN KEY ("created_by_transition_id") REFERENCES "case_transitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_user_id_fkey"
    FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_delegated_from_task_id_fkey"
    FOREIGN KEY ("delegated_from_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "idx_tasks_case_id" ON "tasks"("case_id");
CREATE INDEX "idx_tasks_status" ON "tasks"("status");
CREATE INDEX "idx_tasks_assigned_user" ON "tasks"("assigned_user_id");
CREATE INDEX "idx_tasks_task_type" ON "tasks"("task_type");
CREATE INDEX "idx_tasks_due_at" ON "tasks"("due_at");
CREATE INDEX "idx_tasks_created_by_transition" ON "tasks"("created_by_transition_id");

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_status_check"
    CHECK ("status" IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DELEGATED'));

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_task_type_check"
    CHECK ("task_type" IN (
        'secretariat_review_task',
        'pre_research_task',
        'chair_gate_task',
        'rapporteur_assign_task',
        'rapporteur_report_task',
        'member_approval_task',
        'decision_draft_task',
        'board_review_task',
        'implementation_letter_task',
        'action_response_task',
        'follow_up_review_task'
    ));

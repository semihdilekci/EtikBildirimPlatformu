-- Faz 6 İterasyon 2: SLA policy + iş günü takvimi
CREATE TABLE "sla_policy_configs" (
    "id" TEXT NOT NULL,
    "task_type" TEXT NOT NULL,
    "sla_duration" INTEGER NOT NULL,
    "sla_unit" TEXT NOT NULL DEFAULT 'business_days',
    "warning_threshold_hours" INTEGER NOT NULL DEFAULT 24,
    "daily_overdue_notification" BOOLEAN NOT NULL DEFAULT true,
    "escalation_role" TEXT NOT NULL DEFAULT 'council_secretary',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_no" INTEGER NOT NULL DEFAULT 1,
    "approved_by" TEXT,
    "audit_event_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sla_policy_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "business_calendar_entries" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "day_type" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_no" INTEGER NOT NULL DEFAULT 1,
    "approved_by" TEXT,
    "audit_event_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_calendar_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sla_policy_configs_task_type_key" ON "sla_policy_configs"("task_type");
CREATE UNIQUE INDEX "idx_business_calendar_date" ON "business_calendar_entries"("date");
CREATE INDEX "idx_business_calendar_day_type" ON "business_calendar_entries"("day_type");

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_sla_policy_id_fkey"
    FOREIGN KEY ("sla_policy_id") REFERENCES "sla_policy_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sla_policy_configs" ADD CONSTRAINT "sla_policy_configs_task_type_check"
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

ALTER TABLE "sla_policy_configs" ADD CONSTRAINT "sla_policy_configs_sla_unit_check"
    CHECK ("sla_unit" IN ('calendar_hours', 'business_days'));

ALTER TABLE "business_calendar_entries" ADD CONSTRAINT "business_calendar_entries_day_type_check"
    CHECK ("day_type" IN ('WORKDAY', 'WEEKEND', 'OFFICIAL_HOLIDAY', 'COMPANY_HOLIDAY', 'HALF_DAY'));

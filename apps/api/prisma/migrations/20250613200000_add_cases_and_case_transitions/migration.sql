-- Case management tables + case_transitions append-only trigger (Faz 5 — İterasyon 1).

-- CreateTable
CREATE TABLE "cases" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "current_state" TEXT NOT NULL,
    "workflow_version" VARCHAR(20) NOT NULL,
    "confidentiality_level" TEXT NOT NULL DEFAULT 'SENSITIVE',
    "company_id" TEXT NOT NULL,
    "assigned_rapporteur_id" TEXT,
    "assigned_action_owner_id" TEXT,
    "opened_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ,
    "optimistic_lock_version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_transitions" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "from_state" TEXT NOT NULL,
    "to_state" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "actor_type" TEXT NOT NULL,
    "performed_by_user_id" TEXT,
    "reason_text_masked" TEXT,
    "encryption_metadata" JSONB,
    "idempotency_key" TEXT NOT NULL,
    "audit_event_id" TEXT,
    "transitioned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "idx_cases_report_id" ON "cases"("report_id");

-- CreateIndex
CREATE INDEX "idx_cases_current_state" ON "cases"("current_state");

-- CreateIndex
CREATE INDEX "idx_cases_company_id" ON "cases"("company_id");

-- CreateIndex
CREATE INDEX "idx_cases_confidentiality_level" ON "cases"("confidentiality_level");

-- CreateIndex
CREATE INDEX "idx_cases_assigned_rapporteur" ON "cases"("assigned_rapporteur_id");

-- CreateIndex
CREATE INDEX "idx_cases_assigned_action_owner" ON "cases"("assigned_action_owner_id");

-- CreateIndex
CREATE INDEX "idx_cases_opened_at" ON "cases"("opened_at");

-- CreateIndex
CREATE UNIQUE INDEX "idx_ct_idempotency_key" ON "case_transitions"("idempotency_key");

-- CreateIndex
CREATE INDEX "idx_ct_case_id" ON "case_transitions"("case_id");

-- CreateIndex
CREATE INDEX "idx_ct_transitioned_at" ON "case_transitions"("transitioned_at");

-- CreateIndex
CREATE INDEX "idx_ct_to_state" ON "case_transitions"("to_state");

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_assigned_rapporteur_id_fkey" FOREIGN KEY ("assigned_rapporteur_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_assigned_action_owner_id_fkey" FOREIGN KEY ("assigned_action_owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_transitions" ADD CONSTRAINT "case_transitions_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_transitions" ADD CONSTRAINT "case_transitions_performed_by_user_id_fkey" FOREIGN KEY ("performed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey (reports.case_id → cases.id — bidirectional 1-1 link)
ALTER TABLE "reports" ADD CONSTRAINT "reports_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Append-only enforcement for case_transitions
CREATE OR REPLACE FUNCTION case_transitions_prevent_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'CASE_TRANSITION_APPEND_ONLY_VIOLATION: case_transitions records are immutable (% forbidden)', TG_OP
    USING ERRCODE = 'P0001';
END;
$$;

CREATE TRIGGER trg_case_transitions_prevent_update
  BEFORE UPDATE ON case_transitions
  FOR EACH ROW
  EXECUTE FUNCTION case_transitions_prevent_mutation();

CREATE TRIGGER trg_case_transitions_prevent_delete
  BEFORE DELETE ON case_transitions
  FOR EACH ROW
  EXECUTE FUNCTION case_transitions_prevent_mutation();

CREATE TRIGGER trg_case_transitions_prevent_truncate
  BEFORE TRUNCATE ON case_transitions
  FOR EACH STATEMENT
  EXECUTE FUNCTION case_transitions_prevent_mutation();

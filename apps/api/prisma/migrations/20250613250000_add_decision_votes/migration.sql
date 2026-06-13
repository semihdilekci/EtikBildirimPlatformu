-- Decision votes + append-only trigger (Faz 6 — İterasyon 4)

CREATE TABLE "decision_votes" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "transition_id" TEXT NOT NULL,
    "voter_user_id" TEXT NOT NULL,
    "vote_type" TEXT NOT NULL,
    "reason_text" TEXT,
    "encryption_metadata" JSONB,
    "is_silent_acceptance" BOOLEAN NOT NULL DEFAULT false,
    "created_by_system" BOOLEAN NOT NULL DEFAULT false,
    "voted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "audit_event_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_votes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "decision_votes_vote_type_check" CHECK (
        "vote_type" IN ('APPROVE', 'REJECT', 'SILENT_ACCEPTANCE')
    )
);

CREATE INDEX "idx_dv_case_id" ON "decision_votes"("case_id");
CREATE INDEX "idx_dv_transition_id" ON "decision_votes"("transition_id");
CREATE UNIQUE INDEX "idx_dv_transition_voter_unique" ON "decision_votes"("transition_id", "voter_user_id");

ALTER TABLE "decision_votes" ADD CONSTRAINT "decision_votes_case_id_fkey"
    FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "decision_votes" ADD CONSTRAINT "decision_votes_transition_id_fkey"
    FOREIGN KEY ("transition_id") REFERENCES "case_transitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "decision_votes" ADD CONSTRAINT "decision_votes_voter_user_id_fkey"
    FOREIGN KEY ("voter_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Append-only enforcement for decision_votes
CREATE OR REPLACE FUNCTION decision_votes_prevent_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'DECISION_VOTE_APPEND_ONLY_VIOLATION: decision_votes records are immutable (% forbidden)', TG_OP
    USING ERRCODE = 'P0001';
END;
$$;

CREATE TRIGGER trg_decision_votes_prevent_update
  BEFORE UPDATE ON decision_votes
  FOR EACH ROW
  EXECUTE FUNCTION decision_votes_prevent_mutation();

CREATE TRIGGER trg_decision_votes_prevent_delete
  BEFORE DELETE ON decision_votes
  FOR EACH ROW
  EXECUTE FUNCTION decision_votes_prevent_mutation();

CREATE TRIGGER trg_decision_votes_prevent_truncate
  BEFORE TRUNCATE ON decision_votes
  FOR EACH STATEMENT
  EXECUTE FUNCTION decision_votes_prevent_mutation();

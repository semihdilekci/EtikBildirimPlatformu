-- Task lifecycle events + append-only trigger (Faz 6 — İterasyon 3)

CREATE TABLE "task_events" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "actor_type" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "metadata_json" JSONB,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "task_events_event_type_check" CHECK (
        "event_type" IN (
            'CREATED',
            'STARTED',
            'COMPLETED',
            'CANCELLED',
            'DELEGATED',
            'SLA_WARNED',
            'SLA_BREACHED',
            'PAUSED',
            'RESUMED'
        )
    ),
    CONSTRAINT "task_events_actor_type_check" CHECK ("actor_type" IN ('USER', 'SYSTEM'))
);

CREATE INDEX "idx_task_events_task_id" ON "task_events"("task_id");
CREATE INDEX "idx_task_events_occurred_at" ON "task_events"("occurred_at");

ALTER TABLE "task_events" ADD CONSTRAINT "task_events_task_id_fkey"
    FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "task_events" ADD CONSTRAINT "task_events_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Append-only enforcement for task_events
CREATE OR REPLACE FUNCTION task_events_prevent_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'TASK_EVENT_APPEND_ONLY_VIOLATION: task_events records are immutable (% forbidden)', TG_OP
    USING ERRCODE = 'P0001';
END;
$$;

CREATE TRIGGER trg_task_events_prevent_update
  BEFORE UPDATE ON task_events
  FOR EACH ROW
  EXECUTE FUNCTION task_events_prevent_mutation();

CREATE TRIGGER trg_task_events_prevent_delete
  BEFORE DELETE ON task_events
  FOR EACH ROW
  EXECUTE FUNCTION task_events_prevent_mutation();

CREATE TRIGGER trg_task_events_prevent_truncate
  BEFORE TRUNCATE ON task_events
  FOR EACH STATEMENT
  EXECUTE FUNCTION task_events_prevent_mutation();

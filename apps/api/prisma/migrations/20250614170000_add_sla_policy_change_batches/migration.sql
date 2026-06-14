CREATE TABLE "sla_policy_change_batches" (
    "id" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "approved_by" TEXT,
    "rejected_by" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "resolved_at" TIMESTAMP(3),
    "audit_event_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sla_policy_change_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sla_policy_change_items" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "task_type" TEXT NOT NULL,
    "current_config" JSONB NOT NULL,
    "proposed_config" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sla_policy_change_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_sla_policy_change_batches_status" ON "sla_policy_change_batches"("status");
CREATE INDEX "idx_sla_policy_change_batches_requested_status" ON "sla_policy_change_batches"("requested_by", "status");
CREATE UNIQUE INDEX "idx_sla_policy_change_items_batch_task_type" ON "sla_policy_change_items"("batch_id", "task_type");
CREATE INDEX "idx_sla_policy_change_items_task_type" ON "sla_policy_change_items"("task_type");

ALTER TABLE "sla_policy_change_batches" ADD CONSTRAINT "sla_policy_change_batches_requested_by_fkey"
    FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sla_policy_change_batches" ADD CONSTRAINT "sla_policy_change_batches_approved_by_fkey"
    FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sla_policy_change_batches" ADD CONSTRAINT "sla_policy_change_batches_rejected_by_fkey"
    FOREIGN KEY ("rejected_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sla_policy_change_items" ADD CONSTRAINT "sla_policy_change_items_batch_id_fkey"
    FOREIGN KEY ("batch_id") REFERENCES "sla_policy_change_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sla_policy_change_batches" ADD CONSTRAINT "sla_policy_change_batches_status_check"
    CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED'));

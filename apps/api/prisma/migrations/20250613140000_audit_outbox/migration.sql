-- CreateTable
CREATE TABLE "audit_outbox" (
    "id" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "actor_type" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "resource_type" TEXT,
    "resource_id" TEXT,
    "case_id" TEXT,
    "company_id" TEXT,
    "correlation_id" TEXT,
    "idempotency_key" TEXT,
    "metadata_json" JSONB,
    "dispatch_status" TEXT NOT NULL DEFAULT 'PENDING',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "error_code" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "audit_outbox_idempotency_key_key" ON "audit_outbox"("idempotency_key");

-- CreateIndex
CREATE INDEX "idx_audit_outbox_dispatch_status" ON "audit_outbox"("dispatch_status");

-- CreateIndex
CREATE INDEX "idx_audit_outbox_correlation_id" ON "audit_outbox"("correlation_id");

-- CreateIndex
CREATE INDEX "idx_audit_outbox_created_at" ON "audit_outbox"("created_at");

-- CreateIndex
CREATE INDEX "idx_audit_outbox_event_type" ON "audit_outbox"("event_type");

-- Notification outbox stub (Faz 5 — İterasyon 5). Dispatch Faz 8 worker.

CREATE TABLE "notification_events" (
    "id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient_user_id" TEXT,
    "recipient_tracking_code" TEXT,
    "template_id" TEXT,
    "case_id" TEXT,
    "dispatch_status" TEXT NOT NULL DEFAULT 'PENDING',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "sent_at" TIMESTAMPTZ,
    "error_code" TEXT,
    "correlation_id" TEXT,
    "idempotency_key" TEXT,
    "metadata_json" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_events_idempotency_key_key" ON "notification_events"("idempotency_key");

CREATE INDEX "idx_notification_events_dispatch_status" ON "notification_events"("dispatch_status");

CREATE INDEX "idx_notification_events_correlation_id" ON "notification_events"("correlation_id");

CREATE INDEX "idx_notification_events_case_id" ON "notification_events"("case_id");

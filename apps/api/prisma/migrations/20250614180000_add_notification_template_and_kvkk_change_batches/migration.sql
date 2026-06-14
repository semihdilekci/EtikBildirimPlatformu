CREATE TABLE "notification_template_change_batches" (
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

    CONSTRAINT "notification_template_change_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_template_change_items" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "template_code" TEXT NOT NULL,
    "current_config" JSONB NOT NULL,
    "proposed_config" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_template_change_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "kvkk_text_change_batches" (
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

    CONSTRAINT "kvkk_text_change_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "kvkk_text_change_items" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "version_code" VARCHAR(20) NOT NULL,
    "content_text" TEXT NOT NULL,
    "effective_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kvkk_text_change_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_notification_template_change_batches_status" ON "notification_template_change_batches"("status");
CREATE INDEX "idx_notification_template_change_batches_requested_status" ON "notification_template_change_batches"("requested_by", "status");
CREATE UNIQUE INDEX "idx_notification_template_change_items_batch_code" ON "notification_template_change_items"("batch_id", "template_code");
CREATE INDEX "idx_notification_template_change_items_template_code" ON "notification_template_change_items"("template_code");

CREATE INDEX "idx_kvkk_text_change_batches_status" ON "kvkk_text_change_batches"("status");
CREATE INDEX "idx_kvkk_text_change_batches_requested_status" ON "kvkk_text_change_batches"("requested_by", "status");
CREATE UNIQUE INDEX "idx_kvkk_text_change_items_batch_id" ON "kvkk_text_change_items"("batch_id");
CREATE INDEX "idx_kvkk_text_change_items_version_code" ON "kvkk_text_change_items"("version_code");

ALTER TABLE "notification_template_change_batches" ADD CONSTRAINT "notification_template_change_batches_requested_by_fkey"
    FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notification_template_change_batches" ADD CONSTRAINT "notification_template_change_batches_approved_by_fkey"
    FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notification_template_change_batches" ADD CONSTRAINT "notification_template_change_batches_rejected_by_fkey"
    FOREIGN KEY ("rejected_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "notification_template_change_items" ADD CONSTRAINT "notification_template_change_items_batch_id_fkey"
    FOREIGN KEY ("batch_id") REFERENCES "notification_template_change_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "kvkk_text_change_batches" ADD CONSTRAINT "kvkk_text_change_batches_requested_by_fkey"
    FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "kvkk_text_change_batches" ADD CONSTRAINT "kvkk_text_change_batches_approved_by_fkey"
    FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "kvkk_text_change_batches" ADD CONSTRAINT "kvkk_text_change_batches_rejected_by_fkey"
    FOREIGN KEY ("rejected_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "kvkk_text_change_items" ADD CONSTRAINT "kvkk_text_change_items_batch_id_fkey"
    FOREIGN KEY ("batch_id") REFERENCES "kvkk_text_change_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_template_change_batches" ADD CONSTRAINT "notification_template_change_batches_status_check"
    CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED'));

ALTER TABLE "kvkk_text_change_batches" ADD CONSTRAINT "kvkk_text_change_batches_status_check"
    CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED'));

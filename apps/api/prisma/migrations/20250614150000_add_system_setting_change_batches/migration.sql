-- CreateTable
CREATE TABLE "system_setting_change_batches" (
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

    CONSTRAINT "system_setting_change_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_setting_change_items" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "setting_key" TEXT NOT NULL,
    "current_value" JSONB NOT NULL,
    "proposed_value" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_setting_change_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_system_setting_change_batches_status" ON "system_setting_change_batches"("status");

-- CreateIndex
CREATE INDEX "idx_system_setting_change_batches_requested_status" ON "system_setting_change_batches"("requested_by", "status");

-- CreateIndex
CREATE INDEX "idx_system_setting_change_items_setting_key" ON "system_setting_change_items"("setting_key");

-- CreateIndex
CREATE UNIQUE INDEX "idx_system_setting_change_items_batch_key" ON "system_setting_change_items"("batch_id", "setting_key");

-- AddForeignKey
ALTER TABLE "system_setting_change_batches" ADD CONSTRAINT "system_setting_change_batches_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_setting_change_batches" ADD CONSTRAINT "system_setting_change_batches_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_setting_change_batches" ADD CONSTRAINT "system_setting_change_batches_rejected_by_fkey" FOREIGN KEY ("rejected_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_setting_change_items" ADD CONSTRAINT "system_setting_change_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "system_setting_change_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

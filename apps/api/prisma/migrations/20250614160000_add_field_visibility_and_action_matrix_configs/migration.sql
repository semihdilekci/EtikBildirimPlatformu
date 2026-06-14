-- CreateTable
CREATE TABLE "field_visibility_configs" (
    "id" TEXT NOT NULL,
    "role_code" TEXT NOT NULL,
    "field_name" TEXT NOT NULL,
    "visibility" TEXT NOT NULL,
    "version_no" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "approved_by" TEXT,
    "audit_event_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "field_visibility_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_visibility_change_batches" (
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

    CONSTRAINT "field_visibility_change_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_visibility_change_items" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "role_code" TEXT NOT NULL,
    "field_name" TEXT NOT NULL,
    "current_visibility" TEXT NOT NULL,
    "proposed_visibility" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_visibility_change_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_matrix_configs" (
    "id" TEXT NOT NULL,
    "action_code" TEXT NOT NULL,
    "maker_role" TEXT NOT NULL,
    "checker_role" TEXT NOT NULL,
    "version_no" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "approved_by" TEXT,
    "audit_event_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_matrix_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_matrix_change_batches" (
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

    CONSTRAINT "action_matrix_change_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_matrix_change_items" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "action_code" TEXT NOT NULL,
    "current_maker_role" TEXT NOT NULL,
    "proposed_maker_role" TEXT NOT NULL,
    "current_checker_role" TEXT NOT NULL,
    "proposed_checker_role" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_matrix_change_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "idx_field_visibility_configs_role_field" ON "field_visibility_configs"("role_code", "field_name");

-- CreateIndex
CREATE INDEX "idx_field_visibility_configs_role_code" ON "field_visibility_configs"("role_code");

-- CreateIndex
CREATE INDEX "idx_field_visibility_change_batches_status" ON "field_visibility_change_batches"("status");

-- CreateIndex
CREATE INDEX "idx_field_visibility_change_batches_requested_status" ON "field_visibility_change_batches"("requested_by", "status");

-- CreateIndex
CREATE UNIQUE INDEX "idx_field_visibility_change_items_batch_role_field" ON "field_visibility_change_items"("batch_id", "role_code", "field_name");

-- CreateIndex
CREATE INDEX "idx_field_visibility_change_items_role_field" ON "field_visibility_change_items"("role_code", "field_name");

-- CreateIndex
CREATE UNIQUE INDEX "action_matrix_configs_action_code_key" ON "action_matrix_configs"("action_code");

-- CreateIndex
CREATE INDEX "idx_action_matrix_change_batches_status" ON "action_matrix_change_batches"("status");

-- CreateIndex
CREATE INDEX "idx_action_matrix_change_batches_requested_status" ON "action_matrix_change_batches"("requested_by", "status");

-- CreateIndex
CREATE UNIQUE INDEX "idx_action_matrix_change_items_batch_action" ON "action_matrix_change_items"("batch_id", "action_code");

-- CreateIndex
CREATE INDEX "idx_action_matrix_change_items_action_code" ON "action_matrix_change_items"("action_code");

-- AddForeignKey
ALTER TABLE "field_visibility_change_batches" ADD CONSTRAINT "field_visibility_change_batches_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_visibility_change_batches" ADD CONSTRAINT "field_visibility_change_batches_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_visibility_change_batches" ADD CONSTRAINT "field_visibility_change_batches_rejected_by_fkey" FOREIGN KEY ("rejected_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_visibility_change_items" ADD CONSTRAINT "field_visibility_change_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "field_visibility_change_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_matrix_change_batches" ADD CONSTRAINT "action_matrix_change_batches_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_matrix_change_batches" ADD CONSTRAINT "action_matrix_change_batches_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_matrix_change_batches" ADD CONSTRAINT "action_matrix_change_batches_rejected_by_fkey" FOREIGN KEY ("rejected_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_matrix_change_items" ADD CONSTRAINT "action_matrix_change_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "action_matrix_change_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "approval_work_items" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "action_code" TEXT NOT NULL,
    "assigned_checker_role" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "summary" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "decided_by" TEXT,
    "decided_at" TIMESTAMP(3),
    "decision_reason" TEXT,
    "correlation_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_work_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_awi_status_checker_role" ON "approval_work_items"("status", "assigned_checker_role");

-- CreateIndex
CREATE INDEX "idx_awi_target" ON "approval_work_items"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "idx_awi_requested_by" ON "approval_work_items"("requested_by");

-- AddForeignKey
ALTER TABLE "approval_work_items" ADD CONSTRAINT "approval_work_items_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_work_items" ADD CONSTRAINT "approval_work_items_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Admin async export jobs (audit CSV export — Faz 9 İterasyon 7)
CREATE TABLE "admin_export_jobs" (
    "id" TEXT NOT NULL,
    "export_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requested_by_user_id" TEXT NOT NULL,
    "filter_json" JSONB NOT NULL,
    "storage_key" TEXT,
    "row_count" INTEGER,
    "error_code" TEXT,
    "expires_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_export_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_admin_export_jobs_status" ON "admin_export_jobs"("status");
CREATE INDEX "idx_admin_export_jobs_requested_by" ON "admin_export_jobs"("requested_by_user_id");

-- CreateTable
CREATE TABLE "hr_sync_runs" (
    "id" TEXT NOT NULL,
    "sync_type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "records_processed" INTEGER,
    "records_created" INTEGER,
    "records_updated" INTEGER,
    "records_deactivated" INTEGER,
    "error_code" TEXT,
    "error_detail_masked" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_hr_sync_runs_started_at" ON "hr_sync_runs"("started_at" DESC);

-- CreateTable
CREATE TABLE "report_attachments" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "encrypted_dek" TEXT NOT NULL,
    "kms_key_id" TEXT NOT NULL,
    "content_sha256" VARCHAR(64) NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "malware_scan_status" TEXT NOT NULL DEFAULT 'PENDING',
    "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_by" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_report_attachments_report_id" ON "report_attachments"("report_id");

-- CreateIndex
CREATE INDEX "idx_report_attachments_scan_status" ON "report_attachments"("malware_scan_status");

-- AddForeignKey
ALTER TABLE "report_attachments" ADD CONSTRAINT "report_attachments_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Check constraint: malware_scan_status
ALTER TABLE "report_attachments" ADD CONSTRAINT "report_attachments_malware_scan_status_check"
    CHECK ("malware_scan_status" IN ('PENDING', 'CLEAN', 'QUARANTINED', 'REJECTED'));

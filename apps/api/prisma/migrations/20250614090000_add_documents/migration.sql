-- Document entity + append-only document_versions (Faz 7 — İterasyon 1)

CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "report_id" TEXT,
    "task_id" TEXT,
    "transition_id" TEXT,
    "document_category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "current_version_no" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'QUARANTINED',
    "confidentiality_level" TEXT NOT NULL,
    "retention_policy_id" TEXT,
    "archived_at" TIMESTAMPTZ,
    "uploaded_by_user_id" TEXT,
    "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "documents_status_check" CHECK (
        "status" IN ('UPLOADED', 'QUARANTINED', 'AVAILABLE', 'REJECTED')
    ),
    CONSTRAINT "documents_confidentiality_level_check" CHECK (
        "confidentiality_level" IN ('NORMAL', 'SENSITIVE', 'STRICTLY_CONFIDENTIAL')
    ),
    CONSTRAINT "documents_document_category_check" CHECK (
        "document_category" IN (
            'incoming_report_attachment',
            'pre_research_note',
            'company_evidence',
            'disciplinary_document',
            'rapporteur_report',
            'council_agenda_pack',
            'decision_draft',
            'member_approval_record',
            'board_chair_approval',
            'implementation_letter',
            'action_response',
            'follow_up_decision',
            'closure_note'
        )
    )
);

CREATE TABLE "document_versions" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "version_no" INTEGER NOT NULL,
    "storage_key_ciphertext" TEXT NOT NULL,
    "encrypted_dek" TEXT NOT NULL,
    "kms_key_id" TEXT NOT NULL,
    "content_sha256" VARCHAR(64) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "original_filename_encrypted" TEXT NOT NULL,
    "malware_scan_status" TEXT NOT NULL DEFAULT 'PENDING',
    "scanned_at" TIMESTAMPTZ,
    "uploaded_by_user_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "document_versions_malware_scan_status_check" CHECK (
        "malware_scan_status" IN ('PENDING', 'CLEAN', 'QUARANTINED', 'REJECTED')
    )
);

CREATE INDEX "idx_docs_case_id" ON "documents"("case_id");
CREATE INDEX "idx_docs_document_category" ON "documents"("document_category");
CREATE INDEX "idx_docs_status" ON "documents"("status");
CREATE INDEX "idx_docs_confidentiality_level" ON "documents"("confidentiality_level");
CREATE INDEX "idx_docs_uploaded_at" ON "documents"("uploaded_at");

CREATE UNIQUE INDEX "idx_dv_document_version_unique" ON "document_versions"("document_id", "version_no");
CREATE INDEX "idx_dv_document_id" ON "document_versions"("document_id");

ALTER TABLE "documents" ADD CONSTRAINT "documents_case_id_fkey"
    FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "documents" ADD CONSTRAINT "documents_report_id_fkey"
    FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "documents" ADD CONSTRAINT "documents_task_id_fkey"
    FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "documents" ADD CONSTRAINT "documents_transition_id_fkey"
    FOREIGN KEY ("transition_id") REFERENCES "case_transitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_user_id_fkey"
    FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_fkey"
    FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Append-only enforcement for document_versions
CREATE OR REPLACE FUNCTION document_versions_prevent_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'DOCUMENT_VERSION_APPEND_ONLY_VIOLATION: document_versions records are immutable (% forbidden)', TG_OP
    USING ERRCODE = 'P0001';
END;
$$;

CREATE TRIGGER trg_document_versions_prevent_update
  BEFORE UPDATE ON document_versions
  FOR EACH ROW
  EXECUTE FUNCTION document_versions_prevent_mutation();

CREATE TRIGGER trg_document_versions_prevent_delete
  BEFORE DELETE ON document_versions
  FOR EACH ROW
  EXECUTE FUNCTION document_versions_prevent_mutation();

CREATE TRIGGER trg_document_versions_prevent_truncate
  BEFORE TRUNCATE ON document_versions
  FOR EACH STATEMENT
  EXECUTE FUNCTION document_versions_prevent_mutation();

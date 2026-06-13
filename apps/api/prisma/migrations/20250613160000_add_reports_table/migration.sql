-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "tracking_code" VARCHAR(14) NOT NULL,
    "tracking_code_password_hash" TEXT NOT NULL,
    "is_anonymous" BOOLEAN NOT NULL DEFAULT true,
    "reporter_identity_name" TEXT,
    "reporter_identity_title" TEXT,
    "reporter_identity_relation" TEXT,
    "reporter_contact_email" TEXT,
    "reporter_contact_phone" TEXT,
    "reporter_country" VARCHAR(3),
    "reporter_city" VARCHAR(100),
    "incident_country" VARCHAR(3) NOT NULL,
    "incident_city" VARCHAR(100) NOT NULL,
    "incident_location_detail" TEXT,
    "company_id" TEXT NOT NULL,
    "category_group" TEXT NOT NULL,
    "categories" TEXT[],
    "is_uncertain_category" BOOLEAN NOT NULL DEFAULT false,
    "incident_description" TEXT NOT NULL,
    "incident_date_start" DATE,
    "incident_date_end" DATE,
    "incident_is_ongoing" BOOLEAN NOT NULL DEFAULT false,
    "incident_recurrence" TEXT,
    "how_reporter_learned" TEXT,
    "previously_reported" BOOLEAN NOT NULL DEFAULT false,
    "previously_reported_to" TEXT,
    "urgent_risk_flag" BOOLEAN NOT NULL DEFAULT false,
    "urgent_risk_description" TEXT,
    "involved_persons" TEXT,
    "witnesses" TEXT,
    "category_specific_data" TEXT,
    "encryption_metadata" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "confidentiality_level" TEXT NOT NULL DEFAULT 'SENSITIVE',
    "channel" TEXT NOT NULL DEFAULT 'WEB_FORM',
    "kvkk_consent_version" VARCHAR(20) NOT NULL,
    "kvkk_consent_at" TIMESTAMPTZ NOT NULL,
    "language" VARCHAR(5) NOT NULL DEFAULT 'tr',
    "submitted_at" TIMESTAMPTZ NOT NULL,
    "last_activity_at" TIMESTAMPTZ,
    "case_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "idx_reports_tracking_code" ON "reports"("tracking_code");

-- CreateIndex
CREATE INDEX "idx_reports_company_id" ON "reports"("company_id");

-- CreateIndex
CREATE INDEX "idx_reports_status" ON "reports"("status");

-- CreateIndex
CREATE INDEX "idx_reports_submitted_at" ON "reports"("submitted_at");

-- CreateIndex
CREATE INDEX "idx_reports_confidentiality_level" ON "reports"("confidentiality_level");

-- CreateIndex
CREATE INDEX "idx_reports_case_id" ON "reports"("case_id");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

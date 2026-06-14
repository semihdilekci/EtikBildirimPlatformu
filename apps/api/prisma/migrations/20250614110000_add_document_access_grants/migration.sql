-- DocumentAccessGrant — deny-by-default doküman erişim izinleri (Faz 7 — İterasyon 3)

CREATE TABLE "document_access_grants" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "granted_to_user_id" TEXT,
    "granted_to_role" TEXT,
    "grant_scope" TEXT NOT NULL DEFAULT 'FULL_ACCESS',
    "granted_by_transition_id" TEXT,
    "granted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_access_grants_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "document_access_grants_grant_scope_check" CHECK (
        "grant_scope" IN ('FULL_ACCESS', 'METADATA_ONLY')
    ),
    CONSTRAINT "document_access_grants_target_check" CHECK (
        "granted_to_user_id" IS NOT NULL OR "granted_to_role" IS NOT NULL
    )
);

CREATE INDEX "idx_dag_document_id" ON "document_access_grants"("document_id");
CREATE INDEX "idx_dag_granted_to_user_id" ON "document_access_grants"("granted_to_user_id");
CREATE INDEX "idx_dag_granted_to_role" ON "document_access_grants"("granted_to_role");
CREATE INDEX "idx_dag_revoked_at" ON "document_access_grants"("revoked_at");

ALTER TABLE "document_access_grants" ADD CONSTRAINT "document_access_grants_document_id_fkey"
    FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_access_grants" ADD CONSTRAINT "document_access_grants_granted_to_user_id_fkey"
    FOREIGN KEY ("granted_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "document_access_grants" ADD CONSTRAINT "document_access_grants_granted_by_transition_id_fkey"
    FOREIGN KEY ("granted_by_transition_id") REFERENCES "case_transitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

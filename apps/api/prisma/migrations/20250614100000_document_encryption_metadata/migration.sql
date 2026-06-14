-- Faz 7 — İterasyon 2: envelope encryption metadata

ALTER TABLE "document_versions"
  ADD COLUMN "encryption_algorithm" TEXT NOT NULL DEFAULT 'AES-256-GCM';

ALTER TABLE "documents"
  ADD COLUMN "content_sealed_at" TIMESTAMPTZ;

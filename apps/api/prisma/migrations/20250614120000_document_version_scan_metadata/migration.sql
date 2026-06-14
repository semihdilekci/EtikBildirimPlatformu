-- Async malware scan worker may update scan metadata only — content fields remain append-only.

CREATE OR REPLACE FUNCTION document_versions_prevent_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (
      OLD.id IS NOT DISTINCT FROM NEW.id
      AND OLD.document_id IS NOT DISTINCT FROM NEW.document_id
      AND OLD.version_no IS NOT DISTINCT FROM NEW.version_no
      AND OLD.storage_key_ciphertext IS NOT DISTINCT FROM NEW.storage_key_ciphertext
      AND OLD.encrypted_dek IS NOT DISTINCT FROM NEW.encrypted_dek
      AND OLD.kms_key_id IS NOT DISTINCT FROM NEW.kms_key_id
      AND OLD.encryption_algorithm IS NOT DISTINCT FROM NEW.encryption_algorithm
      AND OLD.content_sha256 IS NOT DISTINCT FROM NEW.content_sha256
      AND OLD.size_bytes IS NOT DISTINCT FROM NEW.size_bytes
      AND OLD.mime_type IS NOT DISTINCT FROM NEW.mime_type
      AND OLD.original_filename_encrypted IS NOT DISTINCT FROM NEW.original_filename_encrypted
      AND OLD.uploaded_by_user_id IS NOT DISTINCT FROM NEW.uploaded_by_user_id
      AND OLD.created_at IS NOT DISTINCT FROM NEW.created_at
    ) THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'DOCUMENT_VERSION_APPEND_ONLY_VIOLATION: document_versions content fields are immutable (UPDATE forbidden)'
      USING ERRCODE = 'P0001';
  END IF;

  RAISE EXCEPTION 'DOCUMENT_VERSION_APPEND_ONLY_VIOLATION: document_versions records are immutable (% forbidden)', TG_OP
    USING ERRCODE = 'P0001';
END;
$$;

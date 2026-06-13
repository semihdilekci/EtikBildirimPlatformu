-- Chain hash + append-only enforcement for audit_events (Faz 3 — İterasyon 3).
-- Hash computation MUST stay in DB triggers — not application code.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION audit_events_compute_chain_hash()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_prev_hash TEXT;
  v_payload TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(8739281);

  SELECT ae.event_hash
  INTO v_prev_hash
  FROM audit_events ae
  ORDER BY ae.created_at DESC, ae.id DESC
  LIMIT 1;

  NEW.prev_hash := v_prev_hash;

  v_payload := jsonb_strip_nulls(
    jsonb_build_object(
      'id', NEW.id,
      'occurred_at', NEW.occurred_at,
      'recorded_at', NEW.recorded_at,
      'event_type', NEW.event_type,
      'event_category', NEW.event_category,
      'severity', NEW.severity,
      'actor_type', NEW.actor_type,
      'actor_id', NEW.actor_id,
      'action', NEW.action,
      'outcome', NEW.outcome,
      'correlation_id', NEW.correlation_id,
      'metadata_json', NEW.metadata_json
    )
  )::text;

  NEW.event_hash := encode(
    digest(
      convert_to(v_payload || COALESCE(v_prev_hash, ''), 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION audit_events_prevent_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'AUDIT_APPEND_ONLY_VIOLATION: audit_events records are immutable (% forbidden)', TG_OP
    USING ERRCODE = 'P0001';
END;
$$;

CREATE TRIGGER trg_audit_events_compute_chain_hash
  BEFORE INSERT ON audit_events
  FOR EACH ROW
  EXECUTE FUNCTION audit_events_compute_chain_hash();

CREATE TRIGGER trg_audit_events_prevent_update
  BEFORE UPDATE ON audit_events
  FOR EACH ROW
  EXECUTE FUNCTION audit_events_prevent_mutation();

CREATE TRIGGER trg_audit_events_prevent_delete
  BEFORE DELETE ON audit_events
  FOR EACH ROW
  EXECUTE FUNCTION audit_events_prevent_mutation();

CREATE TRIGGER trg_audit_events_prevent_truncate
  BEFORE TRUNCATE ON audit_events
  FOR EACH STATEMENT
  EXECUTE FUNCTION audit_events_prevent_mutation();

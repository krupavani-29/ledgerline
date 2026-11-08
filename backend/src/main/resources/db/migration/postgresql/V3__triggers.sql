-- =============================================================================
-- V3__triggers.sql: PostgreSQL Append-Only DB Triggers (AGENTS.md Rule 9)
-- Prevents UPDATE and DELETE operations on ledger_entries and audit_log
-- =============================================================================

-- Advance sequence values past seeded IDs
ALTER SEQUENCE users_id_seq RESTART WITH 10;
ALTER SEQUENCE accounts_id_seq RESTART WITH 10;
ALTER SEQUENCE transactions_id_seq RESTART WITH 10;
ALTER SEQUENCE ledger_entries_id_seq RESTART WITH 10;
ALTER SEQUENCE audit_log_id_seq RESTART WITH 10;

CREATE OR REPLACE FUNCTION prevent_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Table % is strictly append-only; UPDATE and DELETE operations are prohibited.', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ledger_entries_append_only
BEFORE UPDATE OR DELETE ON ledger_entries
FOR EACH ROW EXECUTE FUNCTION prevent_modification();

CREATE TRIGGER trg_audit_log_append_only
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW EXECUTE FUNCTION prevent_modification();

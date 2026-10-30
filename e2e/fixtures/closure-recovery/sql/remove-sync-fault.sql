BEGIN;
DROP TRIGGER IF EXISTS :"fault_name" ON batch.config_sync_log;
DROP FUNCTION IF EXISTS batch.:"fault_name"();
COMMIT;

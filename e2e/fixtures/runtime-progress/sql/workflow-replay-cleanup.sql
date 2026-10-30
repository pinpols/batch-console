BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE TEMP TABLE replay_owned_scope AS SELECT :'tenant_id'::text AS tenant_id;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM batch.replay_operation WHERE tenant_id IN (SELECT tenant_id FROM replay_owned_scope) AND status = 'RUNNING')
    OR EXISTS (SELECT 1 FROM batch.workflow_run WHERE tenant_id IN (SELECT tenant_id FROM replay_owned_scope) AND run_status NOT IN ('SUCCESS', 'FAILED', 'TERMINATED'))
    OR EXISTS (SELECT 1 FROM batch.job_instance WHERE tenant_id IN (SELECT tenant_id FROM replay_owned_scope) AND instance_status NOT IN ('SUCCESS', 'FAILED', 'PARTIAL_FAILED', 'CANCELLED', 'TERMINATED'))
  THEN RAISE EXCEPTION 'Owned replay execution still active'; END IF;
END $$;
DELETE FROM batch.replay_operation_preview_token WHERE tenant_id = :'tenant_id';
DELETE FROM batch.replay_operation WHERE tenant_id = :'tenant_id';
DELETE FROM batch.console_push_approval_notification WHERE tenant_id = :'tenant_id';
DELETE FROM batch.compensation_command WHERE tenant_id = :'tenant_id';
DELETE FROM batch.approval_command WHERE tenant_id = :'tenant_id';
SELECT format('DROP TABLE biz.%I', :'table_name') \gexec
COMMIT;
SELECT json_build_object(
  'replayOperations', (SELECT count(*) FROM batch.replay_operation WHERE tenant_id = :'tenant_id'),
  'replayTokens', (SELECT count(*) FROM batch.replay_operation_preview_token WHERE tenant_id = :'tenant_id'),
  'approvals', (SELECT count(*) FROM batch.approval_command WHERE tenant_id = :'tenant_id'),
  'approvalNotifications', (SELECT count(*) FROM batch.console_push_approval_notification WHERE tenant_id = :'tenant_id'),
  'compensationCommands', (SELECT count(*) FROM batch.compensation_command WHERE tenant_id = :'tenant_id'),
  'businessTables', (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'biz' AND table_name = :'table_name')
);

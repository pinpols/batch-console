BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE TEMP TABLE export_scope AS SELECT :'tenant_id'::text AS tenant_id;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM batch.workflow_run WHERE tenant_id IN (SELECT tenant_id FROM export_scope) AND run_status NOT IN ('SUCCESS','FAILED','TERMINATED'))
    OR EXISTS (SELECT 1 FROM batch.job_task WHERE tenant_id IN (SELECT tenant_id FROM export_scope) AND task_status NOT IN ('SUCCESS','FAILED','CANCELLED','TERMINATED'))
    THEN RAISE EXCEPTION 'Owned EXPORT execution still active'; END IF;
END $$;
CREATE TEMP TABLE export_pipelines AS SELECT id FROM batch.pipeline_instance WHERE tenant_id = :'tenant_id' AND job_code = :'job_code';
DELETE FROM batch.replay_operation_preview_token WHERE tenant_id = :'tenant_id';
DELETE FROM batch.replay_operation WHERE tenant_id = :'tenant_id';
DELETE FROM batch.console_push_approval_notification WHERE tenant_id = :'tenant_id';
DELETE FROM batch.compensation_command WHERE tenant_id = :'tenant_id';
DELETE FROM batch.approval_command WHERE tenant_id = :'tenant_id';
DELETE FROM batch.pipeline_progress WHERE tenant_id = :'tenant_id' AND pipeline_instance_id IN (SELECT id FROM export_pipelines);
DELETE FROM batch.file_dispatch_record WHERE tenant_id = :'tenant_id';
DELETE FROM batch.pipeline_step_run WHERE pipeline_instance_id IN (SELECT id FROM export_pipelines);
DELETE FROM batch.pipeline_instance WHERE tenant_id = :'tenant_id' AND id IN (SELECT id FROM export_pipelines);
DELETE FROM batch.asset_partition WHERE tenant_id = :'tenant_id';
DELETE FROM batch.result_version WHERE tenant_id = :'tenant_id';
DELETE FROM batch.file_audit_log WHERE tenant_id = :'tenant_id';
DELETE FROM batch.file_record WHERE tenant_id = :'tenant_id';
DELETE FROM batch.file_template_config WHERE tenant_id = :'tenant_id' AND template_code = :'template_code';
SELECT format('DROP VIEW biz.%I', :'detail_view') \gexec
SELECT format('DROP TABLE biz.%I', name) FROM unnest(ARRAY[:'detail_table', :'batch_table']) name \gexec
COMMIT;
SELECT json_build_object(
  'exportPipelines', (SELECT count(*) FROM batch.pipeline_instance WHERE tenant_id = :'tenant_id'),
  'exportSteps', (SELECT count(*) FROM batch.pipeline_step_run WHERE pipeline_instance_id IN (SELECT id FROM export_pipelines)),
  'exportCheckpoints', (SELECT count(*) FROM batch.pipeline_progress WHERE tenant_id = :'tenant_id'),
  'exportFiles', (SELECT count(*) FROM batch.file_record WHERE tenant_id = :'tenant_id'),
  'exportTemplates', (SELECT count(*) FROM batch.file_template_config WHERE tenant_id = :'tenant_id'),
  'replayOperations', (SELECT count(*) FROM batch.replay_operation WHERE tenant_id = :'tenant_id'),
  'replayTokens', (SELECT count(*) FROM batch.replay_operation_preview_token WHERE tenant_id = :'tenant_id'),
  'approvals', (SELECT count(*) FROM batch.approval_command WHERE tenant_id = :'tenant_id'),
  'businessRelations', (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'biz' AND table_name IN (:'detail_table', :'batch_table', :'detail_view'))
);

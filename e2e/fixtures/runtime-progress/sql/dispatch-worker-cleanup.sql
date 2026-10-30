-- 只在本例Job/Workflow/Task终态后移除分发、审批、Pipeline与NAS渠道；不触碰业务共享配置。
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE TEMP TABLE dispatch_scope AS SELECT :'tenant_id'::text AS tenant_id;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM batch.workflow_run WHERE tenant_id IN (SELECT tenant_id FROM dispatch_scope) AND run_status NOT IN ('SUCCESS','FAILED','TERMINATED'))
    OR EXISTS (SELECT 1 FROM batch.job_task WHERE tenant_id IN (SELECT tenant_id FROM dispatch_scope) AND task_status NOT IN ('SUCCESS','FAILED','CANCELLED','TERMINATED'))
    THEN RAISE EXCEPTION 'Owned DISPATCH execution still active'; END IF;
END $$;
CREATE TEMP TABLE dispatch_pipelines AS SELECT id FROM batch.pipeline_instance WHERE tenant_id = :'tenant_id' AND job_code = :'job_code';
DELETE FROM batch.replay_operation_preview_token WHERE tenant_id = :'tenant_id';
DELETE FROM batch.replay_operation WHERE tenant_id = :'tenant_id';
DELETE FROM batch.console_push_approval_notification WHERE tenant_id = :'tenant_id';
DELETE FROM batch.compensation_command WHERE tenant_id = :'tenant_id';
DELETE FROM batch.approval_command WHERE tenant_id = :'tenant_id';
DELETE FROM batch.pipeline_progress WHERE tenant_id = :'tenant_id' AND pipeline_instance_id IN (SELECT id FROM dispatch_pipelines);
DELETE FROM batch.file_dispatch_record WHERE tenant_id = :'tenant_id' AND channel_code = :'nas_channel_code';
DELETE FROM batch.pipeline_step_run WHERE pipeline_instance_id IN (SELECT id FROM dispatch_pipelines);
DELETE FROM batch.pipeline_instance WHERE tenant_id = :'tenant_id' AND id IN (SELECT id FROM dispatch_pipelines);
DELETE FROM batch.file_audit_log WHERE tenant_id = :'tenant_id' AND file_id = :'source_file_id'::bigint;
DELETE FROM batch.file_record WHERE tenant_id = :'tenant_id' AND id = :'source_file_id'::bigint;
DELETE FROM batch.file_channel_health WHERE tenant_id = :'tenant_id' AND channel_code = :'nas_channel_code';
DELETE FROM batch.file_channel_config WHERE tenant_id = :'tenant_id' AND channel_code = :'nas_channel_code';
COMMIT;
SELECT json_build_object(
  'dispatchPipelines', (SELECT count(*) FROM batch.pipeline_instance WHERE tenant_id = :'tenant_id'),
  'dispatchSteps', (SELECT count(*) FROM batch.pipeline_step_run WHERE pipeline_instance_id IN (SELECT id FROM dispatch_pipelines)),
  'dispatchCheckpoints', (SELECT count(*) FROM batch.pipeline_progress WHERE tenant_id = :'tenant_id'),
  'dispatchRecords', (SELECT count(*) FROM batch.file_dispatch_record WHERE tenant_id = :'tenant_id'),
  'dispatchSourceFiles', (SELECT count(*) FROM batch.file_record WHERE tenant_id = :'tenant_id' AND id = :'source_file_id'::bigint),
  'dispatchSourceAudits', (SELECT count(*) FROM batch.file_audit_log WHERE tenant_id = :'tenant_id' AND file_id = :'source_file_id'::bigint),
  'dispatchChannels', (SELECT count(*) FROM batch.file_channel_config WHERE tenant_id = :'tenant_id' AND channel_code = :'nas_channel_code'),
  'dispatchHealth', (SELECT count(*) FROM batch.file_channel_health WHERE tenant_id = :'tenant_id' AND channel_code = :'nas_channel_code'),
  'dispatchApprovals', (SELECT count(*) FROM batch.approval_command WHERE tenant_id = :'tenant_id'),
  'dispatchCommands', (SELECT count(*) FROM batch.compensation_command WHERE tenant_id = :'tenant_id')
);

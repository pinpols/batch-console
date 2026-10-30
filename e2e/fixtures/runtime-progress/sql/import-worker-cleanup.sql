BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE TEMP TABLE owned_import_pipelines AS
 SELECT id FROM batch.pipeline_instance WHERE tenant_id = :'tenant_id' AND job_code = :'job_code';
DELETE FROM batch.pipeline_progress WHERE tenant_id = :'tenant_id'
 AND pipeline_instance_id IN (SELECT id FROM owned_import_pipelines);
DELETE FROM batch.file_dispatch_record WHERE tenant_id = :'tenant_id'
 AND pipeline_instance_id IN (SELECT id FROM owned_import_pipelines);
DELETE FROM batch.pipeline_step_run WHERE pipeline_instance_id IN (SELECT id FROM owned_import_pipelines);
DELETE FROM batch.pipeline_instance WHERE tenant_id = :'tenant_id' AND id IN (SELECT id FROM owned_import_pipelines);
SELECT format('DROP TABLE biz.%I', :'table_name') \gexec
SELECT format('DROP FUNCTION biz.%I()', :'pause_function') \gexec
COMMIT;
SELECT json_build_object(
  'importPipelines', (SELECT count(*) FROM batch.pipeline_instance WHERE tenant_id = :'tenant_id' AND job_code = :'job_code'),
  'importSteps', (SELECT count(*) FROM batch.pipeline_step_run WHERE pipeline_instance_id IN (SELECT id FROM owned_import_pipelines)),
  'importCheckpoints', (SELECT count(*) FROM batch.pipeline_progress WHERE tenant_id = :'tenant_id'),
  'businessTables', (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'biz' AND table_name = :'table_name'),
  'pauseFunctions', (SELECT count(*) FROM pg_proc proc JOIN pg_namespace ns ON ns.oid = proc.pronamespace WHERE ns.nspname = 'biz' AND proc.proname = :'pause_function')
);

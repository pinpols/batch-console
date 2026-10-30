BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE TEMP TABLE owned_process_pipelines AS
 SELECT id FROM batch.pipeline_instance WHERE tenant_id = :'tenant_id' AND job_code = :'job_code';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM batch.pipeline_instance WHERE id IN (SELECT id FROM owned_process_pipelines) AND run_status NOT IN ('SUCCESS', 'FAILED', 'CANCELLED', 'TERMINATED')) THEN
    RAISE EXCEPTION 'Owned PROCESS Pipeline is still active';
  END IF;
END $$;
DELETE FROM batch.pipeline_progress WHERE tenant_id = :'tenant_id' AND pipeline_instance_id IN (SELECT id FROM owned_process_pipelines);
DELETE FROM batch.pipeline_step_run WHERE pipeline_instance_id IN (SELECT id FROM owned_process_pipelines);
DELETE FROM batch.pipeline_instance WHERE tenant_id = :'tenant_id' AND id IN (SELECT id FROM owned_process_pipelines);
COMMIT;
SELECT json_build_object(
  'processPipelines', (SELECT count(*) FROM batch.pipeline_instance WHERE tenant_id = :'tenant_id' AND job_code = :'job_code'),
  'processSteps', (SELECT count(*) FROM batch.pipeline_step_run WHERE pipeline_instance_id IN (SELECT id FROM owned_process_pipelines)),
  'processCheckpoints', (SELECT count(*) FROM batch.pipeline_progress WHERE tenant_id = :'tenant_id')
);

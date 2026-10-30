-- 仅为完整快照传输/投影造数，不产生Job或Worker任务。
BEGIN;
WITH pipeline AS (
  INSERT INTO batch.pipeline_instance(tenant_id,system_pipeline_code,system_pipeline_version,
    job_code,pipeline_type,current_stage,run_status,started_at)
  VALUES (:'tenant_id','IMPORT',1,'PIPELINE_PROGRESS_FIXTURE','IMPORT','LOAD','RUNNING',now())
  RETURNING id
), step AS (
  INSERT INTO batch.pipeline_step_run(pipeline_instance_id,step_code,stage_code,run_seq,step_status,started_at)
  SELECT id,'load','LOAD',1,'RUNNING',now() FROM pipeline RETURNING id
), checkpoint AS (
  INSERT INTO batch.pipeline_progress(tenant_id,pipeline_instance_id,stage,processed_count)
  SELECT :'tenant_id',id,'LOAD',3 FROM pipeline RETURNING id
)
SELECT json_build_object('pipelineId',(SELECT id FROM pipeline),'stepId',(SELECT id FROM step));
COMMIT;

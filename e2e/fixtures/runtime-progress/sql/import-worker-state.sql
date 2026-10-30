SELECT set_config('app.tenant_id', :'tenant_id', false) AS ignored \gset
SELECT format('SELECT count(*) AS business_rows, count(DISTINCT record_no) AS distinct_rows FROM biz.%I WHERE tenant_id = %L', :'table_name', :'tenant_id') AS count_sql \gset
:count_sql \gset
SELECT json_build_object(
  'workerHeartbeatMs', (SELECT extract(epoch FROM heartbeat_at) * 1000 FROM batch.worker_registry WHERE tenant_id = :'tenant_id' AND worker_code = :'worker_code'),
  'businessRows', :'business_rows'::int,
  'distinctRows', :'distinct_rows'::int,
  'pipelines', (SELECT coalesce(json_agg(json_build_object(
    'id', id, 'jobInstanceId', related_job_instance_id, 'fileId', file_id,
    'status', run_status, 'stage', current_stage,
    'systemCode', system_pipeline_code, 'systemVersion', system_pipeline_version
  ) ORDER BY id), '[]'::json) FROM batch.pipeline_instance
    WHERE tenant_id = :'tenant_id' AND job_code = :'job_code'),
  'steps', (SELECT coalesce(json_agg(json_build_object(
    'id', step.id, 'pipelineId', step.pipeline_instance_id, 'stage', stage_code,
    'runSeq', run_seq, 'status', step_status, 'errorCode', step.error_code
  ) ORDER BY step.id), '[]'::json) FROM batch.pipeline_step_run step
    JOIN batch.pipeline_instance pipeline ON pipeline.id = step.pipeline_instance_id
    WHERE pipeline.tenant_id = :'tenant_id' AND pipeline.job_code = :'job_code'),
  'checkpoints', (SELECT coalesce(json_agg(json_build_object(
    'pipelineId', progress.pipeline_instance_id, 'stage', progress.stage,
    'processedCount', processed_count, 'completed', completed
  ) ORDER BY progress.id), '[]'::json) FROM batch.pipeline_progress progress
    JOIN batch.pipeline_instance pipeline ON pipeline.id = progress.pipeline_instance_id
    WHERE pipeline.tenant_id = :'tenant_id' AND pipeline.job_code = :'job_code')
);

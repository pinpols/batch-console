SELECT json_build_object(
  'platformDatabase', current_database(),
  'workerHeartbeatMs', (SELECT extract(epoch FROM heartbeat_at) * 1000 FROM batch.worker_registry WHERE tenant_id = :'tenant_id' AND worker_code = :'worker_code'),
  'pipelines', (SELECT coalesce(json_agg(json_build_object(
    'id', id, 'jobInstanceId', related_job_instance_id, 'status', run_status,
    'stage', current_stage, 'systemCode', system_pipeline_code, 'systemVersion', system_pipeline_version
  ) ORDER BY id), '[]'::json) FROM batch.pipeline_instance WHERE tenant_id = :'tenant_id' AND job_code = :'job_code'),
  'steps', (SELECT coalesce(json_agg(json_build_object(
    'id', step.id, 'pipelineId', step.pipeline_instance_id, 'stage', step.stage_code,
    'runSeq', step.run_seq, 'status', step.step_status, 'errorCode', step.error_code,
    'outputSummary', step.output_summary
  ) ORDER BY step.id), '[]'::json) FROM batch.pipeline_step_run step JOIN batch.pipeline_instance pipeline ON pipeline.id = step.pipeline_instance_id WHERE pipeline.tenant_id = :'tenant_id' AND pipeline.job_code = :'job_code'),
  'taskGenerations', (SELECT coalesce(json_agg(json_build_object('taskId', id, 'generationId', process_staging_generation_id, 'batchKey', process_staging_batch_key) ORDER BY id), '[]'::json)
    FROM batch.job_task WHERE tenant_id = :'tenant_id' AND job_instance_id IN (SELECT id FROM batch.job_instance WHERE tenant_id = :'tenant_id' AND job_code = :'job_code'))
);

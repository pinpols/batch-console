SELECT set_config('app.tenant_id', :'tenant_id', false) AS ignored \gset
SELECT format('SELECT count(*) AS business_rows, count(DISTINCT record_no) AS distinct_rows FROM biz.%I WHERE tenant_id = %L', :'detail_table', :'tenant_id') AS count_sql \gset
:count_sql \gset
SELECT json_build_object(
  'workerHeartbeatMs', (SELECT extract(epoch FROM heartbeat_at) * 1000 FROM batch.worker_registry WHERE tenant_id = :'tenant_id' AND worker_code = :'worker_code'),
  'workerCapabilities', (SELECT replay_capabilities FROM batch.worker_registry WHERE tenant_id = :'tenant_id' AND worker_code = :'worker_code'),
  'businessRows', :'business_rows'::int, 'distinctRows', :'distinct_rows'::int,
  'activeSourceQueries', (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()
    AND state = 'active' AND pid != pg_backend_pid() AND position(:'detail_view' IN query) > 0),
  'pipelines', (SELECT coalesce(json_agg(json_build_object(
    'id', id, 'jobInstanceId', related_job_instance_id, 'fileId', file_id,
    'status', run_status, 'stage', current_stage,
    'systemCode', system_pipeline_code, 'systemVersion', system_pipeline_version
  ) ORDER BY id), '[]'::json) FROM batch.pipeline_instance WHERE tenant_id = :'tenant_id' AND job_code = :'job_code'),
  'steps', (SELECT coalesce(json_agg(json_build_object(
    'id', s.id, 'pipelineId', s.pipeline_instance_id, 'stage', s.stage_code,
    'runSeq', s.run_seq, 'status', s.step_status, 'errorCode', s.error_code
  ) ORDER BY s.id), '[]'::json) FROM batch.pipeline_step_run s JOIN batch.pipeline_instance p ON p.id = s.pipeline_instance_id WHERE p.tenant_id = :'tenant_id' AND p.job_code = :'job_code'),
  'checkpoints', (SELECT coalesce(json_agg(json_build_object(
    'pipelineId', pipeline_instance_id, 'stage', stage, 'processedCount', processed_count, 'completed', completed
  ) ORDER BY id), '[]'::json) FROM batch.pipeline_progress WHERE tenant_id = :'tenant_id'),
  'files', (SELECT coalesce(json_agg(json_build_object(
    'id', id, 'status', file_status, 'bucket', storage_bucket, 'path', storage_path,
    'size', file_size_bytes, 'sha256', checksum_value, 'jobInstanceId', metadata_json->>'jobInstanceId'
  ) ORDER BY id), '[]'::json) FROM batch.file_record WHERE tenant_id = :'tenant_id'),
  'operations', (SELECT coalesce(json_agg(json_build_object(
    'id', id, 'status', status, 'sourceRunId', source_workflow_run_id,
    'targetRunId', target_workflow_run_id, 'requestedBy', requested_by, 'approvedBy', approved_by,
    'resultPolicy', result_policy, 'configPolicy', config_version_policy,
    'total', total_count, 'succeeded', succeeded_count, 'inFlight', in_flight_count
  ) ORDER BY id), '[]'::json) FROM batch.replay_operation WHERE tenant_id = :'tenant_id' AND operation_type = 'WORKFLOW_RUN')
);

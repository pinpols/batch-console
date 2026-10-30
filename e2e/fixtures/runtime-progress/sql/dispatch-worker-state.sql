-- 只回读本例正式Worker、阶段、持久回执与恢复授权，不修改运行状态。
SELECT json_build_object(
  'sourceObjectFileCount', (SELECT count(*) FROM batch.file_record f JOIN batch.file_record source ON f.storage_bucket = source.storage_bucket AND f.storage_path = source.storage_path WHERE source.tenant_id = :'tenant_id' AND source.id = :'source_file_id'::bigint),
  'workerHeartbeatMs', (SELECT extract(epoch FROM heartbeat_at) * 1000 FROM batch.worker_registry WHERE tenant_id = :'tenant_id' AND worker_code = :'worker_code'),
  'pipelines', (SELECT coalesce(json_agg(json_build_object(
    'id', id, 'jobInstanceId', related_job_instance_id, 'fileId', file_id, 'status', run_status, 'stage', current_stage
  ) ORDER BY id), '[]'::json) FROM batch.pipeline_instance WHERE tenant_id = :'tenant_id' AND job_code = :'job_code'),
  'steps', (SELECT coalesce(json_agg(json_build_object(
    'id', s.id, 'pipelineId', s.pipeline_instance_id, 'stage', s.stage_code,
    'runSeq', s.run_seq, 'status', s.step_status, 'errorCode', s.error_code
  ) ORDER BY s.id), '[]'::json) FROM batch.pipeline_step_run s JOIN batch.pipeline_instance p ON p.id = s.pipeline_instance_id WHERE p.tenant_id = :'tenant_id' AND p.job_code = :'job_code'),
  'deliveries', (SELECT coalesce(json_agg(json_build_object(
    'id', id, 'pipelineId', pipeline_instance_id, 'status', dispatch_status,
    'receiptStatus', receipt_status, 'receiptCode', receipt_code, 'externalRequestId', external_request_id,
    'attempt', dispatch_attempt, 'errorCode', error_code
  ) ORDER BY id), '[]'::json) FROM batch.file_dispatch_record WHERE tenant_id = :'tenant_id' AND channel_code = :'nas_channel_code'),
  'deadLetters', (SELECT coalesce(json_agg(json_build_object(
    'id', id, 'sourceId', source_id::text, 'reason', dead_letter_reason, 'replayStatus', replay_status
  ) ORDER BY id), '[]'::json) FROM batch.dead_letter_task WHERE tenant_id = :'tenant_id'),
  'resolutions', (SELECT coalesce(json_agg(json_build_object(
    'taskId', id, 'status', task_status, 'errorCode', error_code,
    'version', external_outcome_resolution_version,
    'requestId', external_outcome_resolution_trigger_request_id,
    'consumed', external_outcome_resolution_consumed_at IS NOT NULL
  ) ORDER BY id), '[]'::json) FROM batch.job_task WHERE tenant_id = :'tenant_id' AND job_instance_id IN (SELECT id FROM batch.job_instance WHERE tenant_id = :'tenant_id' AND job_code = :'job_code'))
);

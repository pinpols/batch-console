SELECT json_build_object(
  'worker', (
    SELECT json_build_object('status', status, 'workerGroup', worker_group)
    FROM batch.worker_registry
    WHERE tenant_id = :'tenant_id' AND worker_code = :'worker_code'
  ),
  'runs', (
    SELECT coalesce(json_agg(json_build_object('id', id, 'status', run_status) ORDER BY id), '[]'::json)
    FROM batch.workflow_run
    WHERE tenant_id = :'tenant_id'
      AND workflow_definition_id IN (
        SELECT id FROM batch.workflow_definition
        WHERE tenant_id = :'tenant_id' AND workflow_code = :'workflow_code'
      )
  ),
  'nodes', (
    SELECT coalesce(json_agg(json_build_object(
      'workflowRunId', run.id, 'nodeCode', node.node_code, 'status', node.node_status,
      'jobInstanceId', node.job_instance_id
    ) ORDER BY run.id, node.node_code), '[]'::json)
    FROM batch.workflow_run run
    JOIN batch.workflow_node_run node ON node.workflow_run_id = run.id
    WHERE run.tenant_id = :'tenant_id'
      AND run.workflow_definition_id IN (
        SELECT id FROM batch.workflow_definition
        WHERE tenant_id = :'tenant_id' AND workflow_code = :'workflow_code'
      )
  ),
  'instances', (
    SELECT coalesce(json_agg(json_build_object(
      'id', id, 'status', instance_status, 'expectedPartitions', expected_partition_count,
      'successPartitions', success_partition_count, 'failedPartitions', failed_partition_count
    ) ORDER BY id), '[]'::json)
    FROM batch.job_instance
    WHERE tenant_id = :'tenant_id' AND (job_code = :'job_code' OR job_definition_id = ANY(
          string_to_array(NULLIF(:'job_definition_ids', ''), ',')::bigint[]))
  ),
  'partitions', (
    SELECT coalesce(json_agg(json_build_object(
      'id', id, 'jobInstanceId', job_instance_id, 'status', partition_status, 'workerCode', worker_code
    ) ORDER BY id), '[]'::json)
    FROM batch.job_partition
    WHERE tenant_id = :'tenant_id'
      AND job_instance_id IN (
        SELECT id FROM batch.job_instance WHERE tenant_id = :'tenant_id' AND (job_code = :'job_code' OR job_definition_id = ANY(
          string_to_array(NULLIF(:'job_definition_ids', ''), ',')::bigint[]))
      )
  ),
  'tasks', (
    SELECT coalesce(json_agg(json_build_object(
      'id', id, 'jobInstanceId', job_instance_id, 'status', task_status,
      'workerCode', assigned_worker_code
    ) ORDER BY id), '[]'::json)
    FROM batch.job_task
    WHERE tenant_id = :'tenant_id'
      AND job_instance_id IN (
        SELECT id FROM batch.job_instance WHERE tenant_id = :'tenant_id' AND (job_code = :'job_code' OR job_definition_id = ANY(
          string_to_array(NULLIF(:'job_definition_ids', ''), ',')::bigint[]))
      )
  )
);

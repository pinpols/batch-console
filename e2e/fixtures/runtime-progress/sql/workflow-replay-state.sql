SELECT json_build_object(
  'failedTaskCodes', (SELECT coalesce(json_agg(error_code ORDER BY id), '[]'::json)
    FROM batch.job_task WHERE tenant_id = :'tenant_id' AND task_status = 'FAILED'),
  'failedTasks', (SELECT coalesce(json_agg(json_build_object(
    'code', error_code, 'message', error_message
  ) ORDER BY id), '[]'::json) FROM batch.job_task
    WHERE tenant_id = :'tenant_id' AND task_status = 'FAILED'),
  'runs', (SELECT coalesce(json_agg(json_build_object('id', id, 'status', run_status,
    'startedAtMs', floor(extract(epoch FROM started_at) * 1000),
    'finishedAtMs', floor(extract(epoch FROM finished_at) * 1000)) ORDER BY id), '[]'::json)
    FROM batch.workflow_run WHERE tenant_id = :'tenant_id'),
  'nodes', (SELECT coalesce(json_agg(json_build_object(
    'id', node.id, 'runId', run.id, 'code', node.node_code, 'type', node.node_type,
    'status', node.node_status, 'jobInstanceId', node.job_instance_id
  ) ORDER BY node.id), '[]'::json) FROM batch.workflow_node_run node
    JOIN batch.workflow_run run ON run.id = node.workflow_run_id WHERE run.tenant_id = :'tenant_id'),
  'approvals', (SELECT coalesce(json_agg(json_build_object(
    'number', approval_no, 'status', approval_status, 'requester', requester_id,
    'approver', approver_id, 'targetType', target_type, 'targetId', target_id
  ) ORDER BY id), '[]'::json) FROM batch.approval_command WHERE tenant_id = :'tenant_id'),
  'operations', (SELECT coalesce(json_agg(json_build_object(
    'id', id, 'status', status, 'sourceRunId', source_workflow_run_id,
    'sourceNodeId', source_workflow_node_run_id, 'sourceJobId', source_job_instance_id,
    'targetRunId', target_workflow_run_id, 'targetRequestId', target_request_id,
    'requestedBy', requested_by, 'approvedBy', approved_by,
    'total', total_count, 'succeeded', succeeded_count, 'inFlight', in_flight_count
  ) ORDER BY id), '[]'::json) FROM batch.replay_operation
    WHERE tenant_id = :'tenant_id' AND operation_type = 'WORKFLOW_NODE'),
  'commands', (SELECT coalesce(json_agg(json_build_object(
    'status', command_status, 'type', compensation_type, 'sourceJobId', related_job_instance_id
  ) ORDER BY id), '[]'::json) FROM batch.compensation_command WHERE tenant_id = :'tenant_id')
);

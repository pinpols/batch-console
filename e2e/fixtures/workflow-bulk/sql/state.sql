-- 回读本例独占租户的原请求、根运行和控制节点；不以 HTTP 受理代替业务终态。
SELECT json_build_object(
    'definitions', (SELECT coalesce(json_agg(json_build_object(
        'id', id, 'workflowCode', workflow_code) ORDER BY id), '[]'::json)
        FROM batch.workflow_definition WHERE tenant_id = :'tenant_id'),
    'requests', (SELECT coalesce(json_agg(json_build_object(
        'id', id, 'workflowDefinitionId', workflow_definition_id, 'requestId', request_id,
        'status', request_status, 'key', dedup_key) ORDER BY id), '[]'::json)
        FROM batch.trigger_request WHERE tenant_id = :'tenant_id'),
    'runs', (SELECT coalesce(json_agg(json_build_object(
        'id', id, 'workflowDefinitionId', workflow_definition_id, 'status', run_status,
        'triggerRequestId', trigger_request_id, 'bizDate', biz_date) ORDER BY id), '[]'::json)
        FROM batch.workflow_run WHERE tenant_id = :'tenant_id'),
    'nodes', (SELECT coalesce(json_agg(json_build_object(
        'workflowRunId', workflow_run_id, 'nodeCode', node_code, 'status', node_status)
        ORDER BY workflow_run_id, node_code), '[]'::json)
        FROM batch.workflow_node_run
        WHERE workflow_run_id IN (SELECT id FROM batch.workflow_run WHERE tenant_id = :'tenant_id')),
    'terminalEvents', (SELECT coalesce(json_agg(json_build_object(
        'key', event_key, 'status', publish_status) ORDER BY event_key), '[]'::json)
        FROM batch.outbox_event WHERE tenant_id = :'tenant_id'
          AND aggregate_type = 'WORKFLOW_RUN'),
    'jobInstances', (SELECT count(*) FROM batch.job_instance WHERE tenant_id = :'tenant_id')
);

BEGIN;
INSERT INTO batch.workflow_definition (
  tenant_id, workflow_code, workflow_name, workflow_type, version,
  schedule_type, trigger_mode, calendar_code, timezone, schedule_enabled,
  enabled, created_by, updated_by
)
VALUES (
  :'tenant_id', :'workflow_code', 'Manual upload bundle acceptance', 'DAG', 1,
  'MANUAL', 'EVENT', :'calendar_code', 'UTC', false,
  true, 'e2e', 'e2e'
)
RETURNING id AS workflow_definition_id \gset

INSERT INTO batch.workflow_node (
  tenant_id, workflow_definition_id, node_code, node_name, node_type, node_order, enabled
)
VALUES
  (:'tenant_id', :'workflow_definition_id', 'START', 'Start', 'START', 0, true),
  (:'tenant_id', :'workflow_definition_id', 'END', 'End', 'END', 1, true);

INSERT INTO batch.workflow_edge (
  tenant_id, workflow_definition_id, from_node_code, to_node_code, edge_type, enabled
)
VALUES (:'tenant_id', :'workflow_definition_id', 'START', 'END', 'SUCCESS', true);

INSERT INTO batch.file_group_expectation_definition (
  tenant_id, calendar_code, workflow_definition_id, file_group_code,
  expected_local_time, due_local_time, enabled
)
VALUES (
  :'tenant_id', :'calendar_code', :'workflow_definition_id', :'file_group_code',
  TIME '00:00', TIME '23:59', true
);

INSERT INTO batch.file_template_config (
  tenant_id, template_code, template_name, template_type, file_format_type,
  enabled, version, created_by, updated_by
)
VALUES (
  :'tenant_id', :'template_code', 'Manual upload bundle template', 'IMPORT', 'DELIMITED',
  true, 1, 'e2e', 'e2e'
);
COMMIT;

SELECT json_build_object(
  'workflowDefinitionId', :'workflow_definition_id'::bigint,
  'uploadTargetCount', (
    SELECT count(*)
      FROM batch.file_group_expectation_definition expectation
      JOIN batch.workflow_definition workflow
        ON workflow.tenant_id = expectation.tenant_id
       AND workflow.id = expectation.workflow_definition_id
     WHERE expectation.tenant_id = :'tenant_id'
       AND expectation.calendar_code = :'calendar_code'
       AND expectation.file_group_code = :'file_group_code'
       AND expectation.enabled
       AND workflow.enabled
  )
);

SELECT json_build_object(
  'readinessCount', (SELECT count(*) FROM batch.readiness_wait
                      WHERE tenant_id = :'tenant_id'
                        AND workflow_definition_id = :'workflow_definition_id'::bigint
                        AND request_id = :'readiness_request_id'),
  'capacityCount', (SELECT count(*) FROM batch.workflow_launch_wait
                     WHERE tenant_id = :'tenant_id'
                       AND workflow_definition_id = :'workflow_definition_id'::bigint
                       AND request_id = :'capacity_request_id'),
  'workflowCode', (SELECT workflow_code FROM batch.workflow_definition
                    WHERE tenant_id = :'tenant_id'
                      AND id = :'workflow_definition_id'::bigint),
  'privatePayloadMarkerPresent', EXISTS(
      SELECT 1 FROM batch.workflow_launch_wait
       WHERE tenant_id = :'tenant_id'
         AND workflow_definition_id = :'workflow_definition_id'::bigint
         AND request_id = :'capacity_request_id'
         AND launch_payload ->> 'privateMarker' = 'PERSISTENT_WAIT_PRIVATE_PAYLOAD'));

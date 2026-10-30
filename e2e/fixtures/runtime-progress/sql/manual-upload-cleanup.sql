BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TEMP TABLE owned_upload_files ON COMMIT PRESERVE ROWS AS
SELECT id
  FROM batch.file_record
 WHERE tenant_id = :'tenant_id'
   AND metadata_json ->> 'channelCode' = :'channel_code'
   AND metadata_json ->> 'uploadMode' = 'APP_MANAGED';

CREATE TEMP TABLE owned_definitions ON COMMIT PRESERVE ROWS AS
SELECT id, tenant_id
  FROM batch.workflow_definition
 WHERE tenant_id = :'tenant_id'
   AND workflow_code = :'workflow_code';

DO $$ BEGIN
  PERFORM id
    FROM batch.workflow_definition
   WHERE id IN (SELECT id FROM owned_definitions)
   FOR UPDATE;
END $$;

CREATE TEMP TABLE owned_runs ON COMMIT PRESERVE ROWS AS
SELECT id, tenant_id, run_status
  FROM batch.workflow_run
 WHERE tenant_id = :'tenant_id'
   AND workflow_definition_id IN (SELECT id FROM owned_definitions);

CREATE TEMP TABLE owned_requests ON COMMIT PRESERVE ROWS AS
SELECT id, tenant_id, request_id
  FROM batch.trigger_request
 WHERE tenant_id = :'tenant_id'
   AND (workflow_definition_id IN (SELECT id FROM owned_definitions)
     OR parent_workflow_run_id IN (SELECT id FROM owned_runs));

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM owned_runs
     WHERE run_status NOT IN ('SUCCESS', 'SUCCESS_DRY_RUN', 'FAILED', 'FAILED_DRY_RUN', 'TERMINATED')
  ) THEN
    RAISE EXCEPTION 'Manual upload Workflow still active';
  END IF;
  IF EXISTS (
    SELECT 1 FROM batch.job_instance
     WHERE trigger_request_id IN (SELECT id FROM owned_requests)
  ) THEN
    RAISE EXCEPTION 'Unexpected Job side effects from manual upload Workflow';
  END IF;
END $$;

CREATE TEMP TABLE owned_events ON COMMIT PRESERVE ROWS AS
SELECT id, event_key
  FROM batch.outbox_event
 WHERE tenant_id = :'tenant_id'
   AND aggregate_type = 'WORKFLOW_RUN'
   AND aggregate_id IN (SELECT id FROM owned_runs);

CREATE TEMP TABLE owned_terminal_keys ON COMMIT PRESERVE ROWS AS
SELECT :'tenant_id' || ':workflow:' || id || ':terminal' AS event_key
  FROM owned_runs;

DELETE FROM batch.webhook_delivery_log
 WHERE tenant_id = :'tenant_id'
   AND terminal_event_key IN (SELECT event_key FROM owned_terminal_keys);
DELETE FROM batch.notification_delivery_log
 WHERE tenant_id = :'tenant_id'
   AND terminal_event_key IN (SELECT event_key FROM owned_terminal_keys);
DELETE FROM batch.workflow_terminal_notification_receipt
 WHERE tenant_id = :'tenant_id'
   AND event_key IN (SELECT event_key FROM owned_terminal_keys);
DELETE FROM batch.event_delivery_log
 WHERE tenant_id = :'tenant_id'
   AND outbox_event_id IN (SELECT id FROM owned_events);
DELETE FROM batch.event_outbox_retry
 WHERE tenant_id = :'tenant_id'
   AND outbox_event_id IN (SELECT id FROM owned_events);
DELETE FROM batch.outbox_event
 WHERE tenant_id = :'tenant_id'
   AND id IN (SELECT id FROM owned_events);
DELETE FROM batch.outbox_event_dedup_key
 WHERE tenant_id = :'tenant_id'
   AND event_key IN (SELECT event_key FROM owned_events);
DELETE FROM batch.workflow_node_run
 WHERE workflow_run_id IN (SELECT id FROM owned_runs);
DELETE FROM batch.expected_work_occurrence
 WHERE tenant_id = :'tenant_id'
   AND workflow_definition_id IN (SELECT id FROM owned_definitions);
DELETE FROM batch.workflow_run
 WHERE tenant_id = :'tenant_id'
   AND id IN (SELECT id FROM owned_runs);
DELETE FROM batch.trigger_outbox_event
 WHERE tenant_id = :'tenant_id'
   AND request_id IN (SELECT request_id FROM owned_requests);
DELETE FROM batch.trigger_request_idempotency_alias
 WHERE tenant_id = :'tenant_id'
   AND request_id IN (SELECT request_id FROM owned_requests);
DELETE FROM batch.trigger_request
 WHERE tenant_id = :'tenant_id'
   AND id IN (SELECT id FROM owned_requests);
DELETE FROM batch.workflow_definition_version
 WHERE tenant_id = :'tenant_id'
   AND workflow_definition_id IN (SELECT id FROM owned_definitions);
DELETE FROM batch.file_audit_log audit
 USING owned_upload_files owned
 WHERE audit.tenant_id = :'tenant_id'
   AND audit.file_id = owned.id;
DELETE FROM batch.file_record file
 USING owned_upload_files owned
 WHERE file.tenant_id = :'tenant_id'
   AND file.id = owned.id;
DELETE FROM batch.file_channel_config
 WHERE tenant_id = :'tenant_id'
   AND channel_code = :'channel_code';
DELETE FROM batch.file_group_expectation_definition
 WHERE tenant_id = :'tenant_id'
   AND file_group_code = :'file_group_code';
DELETE FROM batch.file_template_config
 WHERE tenant_id = :'tenant_id'
   AND template_code = :'template_code';
DELETE FROM batch.workflow_edge
 WHERE tenant_id = :'tenant_id'
   AND workflow_definition_id IN (SELECT id FROM owned_definitions);
DELETE FROM batch.workflow_node
 WHERE tenant_id = :'tenant_id'
   AND workflow_definition_id IN (SELECT id FROM owned_definitions);
DELETE FROM batch.console_operation_audit
 WHERE tenant_id = :'tenant_id'
   AND ((aggregate_type = 'workflow_definition'
         AND aggregate_id IN (SELECT id::text FROM owned_definitions))
     OR (aggregate_type = 'workflow_run'
         AND aggregate_id IN (SELECT id::text FROM owned_runs)));
DELETE FROM batch.workflow_definition
 WHERE tenant_id = :'tenant_id'
   AND id IN (SELECT id FROM owned_definitions);
COMMIT;

SELECT json_build_object(
  'fileRowsRemaining', (SELECT count(*) FROM batch.file_record
                         WHERE tenant_id = :'tenant_id'
                           AND metadata_json ->> 'channelCode' = :'channel_code'
                           AND metadata_json ->> 'uploadMode' = 'APP_MANAGED'),
  'fileAuditsRemaining', (SELECT count(*) FROM batch.file_audit_log
                           WHERE tenant_id = :'tenant_id'
                             AND file_id IN (SELECT id FROM owned_upload_files)),
  'channelsRemaining', (SELECT count(*) FROM batch.file_channel_config
                         WHERE tenant_id = :'tenant_id'
                           AND channel_code = :'channel_code'),
  'expectationsRemaining', (SELECT count(*) FROM batch.file_group_expectation_definition
                             WHERE tenant_id = :'tenant_id'
                               AND file_group_code = :'file_group_code'),
  'templatesRemaining', (SELECT count(*) FROM batch.file_template_config
                          WHERE tenant_id = :'tenant_id'
                            AND template_code = :'template_code'),
  'workflowDefinitionsRemaining', (SELECT count(*) FROM batch.workflow_definition
                                     WHERE tenant_id = :'tenant_id'
                                       AND workflow_code = :'workflow_code'),
  'workflowNodesRemaining', (SELECT count(*) FROM batch.workflow_node
                              WHERE tenant_id = :'tenant_id'
                                AND workflow_definition_id IN (SELECT id FROM owned_definitions)),
  'workflowEdgesRemaining', (SELECT count(*) FROM batch.workflow_edge
                              WHERE tenant_id = :'tenant_id'
                                AND workflow_definition_id IN (SELECT id FROM owned_definitions)),
  'workflowRunsRemaining', (SELECT count(*) FROM batch.workflow_run
                             WHERE tenant_id = :'tenant_id'
                               AND id IN (SELECT id FROM owned_runs)),
  'workflowNodeRunsRemaining', (SELECT count(*) FROM batch.workflow_node_run
                                 WHERE workflow_run_id IN (SELECT id FROM owned_runs)),
  'triggerRequestsRemaining', (SELECT count(*) FROM batch.trigger_request
                                WHERE tenant_id = :'tenant_id'
                                  AND id IN (SELECT id FROM owned_requests)),
  'jobInstancesRemaining', (SELECT count(*) FROM batch.job_instance
                             WHERE tenant_id = :'tenant_id'
                               AND trigger_request_id IN (SELECT id FROM owned_requests)),
  'workflowAuditsRemaining', (SELECT count(*) FROM batch.console_operation_audit
                               WHERE tenant_id = :'tenant_id'
                                 AND ((aggregate_type = 'workflow_definition'
                                       AND aggregate_id IN (SELECT id::text FROM owned_definitions))
                                   OR (aggregate_type = 'workflow_run'
                                       AND aggregate_id IN (SELECT id::text FROM owned_runs)))),
  'triggerOutboxEventsRemaining', (SELECT count(*) FROM batch.trigger_outbox_event
                                    WHERE tenant_id = :'tenant_id'
                                      AND request_id IN (SELECT request_id FROM owned_requests)),
  'idempotencyAliasesRemaining', (SELECT count(*) FROM batch.trigger_request_idempotency_alias
                                   WHERE tenant_id = :'tenant_id'
                                     AND request_id IN (SELECT request_id FROM owned_requests)),
  'workflowEventsRemaining', (SELECT count(*) FROM batch.outbox_event
                               WHERE tenant_id = :'tenant_id'
                                 AND id IN (SELECT id FROM owned_events)),
  'eventDeliveriesRemaining', (SELECT count(*) FROM batch.event_delivery_log
                                WHERE tenant_id = :'tenant_id'
                                  AND outbox_event_id IN (SELECT id FROM owned_events)),
  'eventRetriesRemaining', (SELECT count(*) FROM batch.event_outbox_retry
                             WHERE tenant_id = :'tenant_id'
                               AND outbox_event_id IN (SELECT id FROM owned_events)),
  'terminalReceiptsRemaining', (SELECT count(*) FROM batch.workflow_terminal_notification_receipt
                                 WHERE tenant_id = :'tenant_id'
                                   AND event_key IN (SELECT event_key FROM owned_terminal_keys)),
  'terminalNotificationDeliveriesRemaining', (SELECT count(*) FROM batch.notification_delivery_log
                                               WHERE tenant_id = :'tenant_id'
                                                 AND terminal_event_key IN (SELECT event_key FROM owned_terminal_keys)),
  'terminalWebhookDeliveriesRemaining', (SELECT count(*) FROM batch.webhook_delivery_log
                                          WHERE tenant_id = :'tenant_id'
                                            AND terminal_event_key IN (SELECT event_key FROM owned_terminal_keys)),
  'dedupKeysRemaining', (SELECT count(*) FROM batch.outbox_event_dedup_key
                          WHERE tenant_id = :'tenant_id'
                            AND event_key IN (SELECT event_key FROM owned_events))
);

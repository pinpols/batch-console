-- SQL只建立真实持久等待行；Console/Orchestrator查询和前端展示仍走真实服务。
BEGIN;
SET LOCAL statement_timeout = '15s';
SET LOCAL app.tenant_id = :'tenant_id';

INSERT INTO batch.trigger_request
  (tenant_id, request_id, trigger_type, job_code, workflow_definition_id, biz_date,
   dedup_key, request_payload_hash, request_status, trace_id)
VALUES
  (:'tenant_id', :'readiness_request_id', 'MANUAL', NULL,
   :'workflow_definition_id'::bigint, :'biz_date'::date,
   :'readiness_request_id', 'e2e-readiness-hash', 'ACCEPTED', 'e2e-readiness-trace'),
  (:'tenant_id', :'capacity_request_id', 'MANUAL', NULL,
   :'workflow_definition_id'::bigint, :'biz_date'::date,
   :'capacity_request_id', 'e2e-capacity-hash', 'ACCEPTED', 'e2e-capacity-trace');

INSERT INTO batch.readiness_wait
  (tenant_id, workflow_definition_id, workflow_code, calendar_code, schedule_version,
   depends_on_job_codes, biz_date, scheduled_fire_time, deferred_since, deadline,
   wait_status, request_id, trace_id, last_error_code)
VALUES
  (:'tenant_id', :'workflow_definition_id'::bigint, :'workflow_code', :'calendar_code', 1,
   'upstream-a,upstream-b', :'biz_date'::date,
   current_timestamp - interval '2 minutes', current_timestamp - interval '90 seconds',
   current_timestamp + interval '1 hour', 'PENDING', :'readiness_request_id',
   'e2e-readiness-trace', 'UPSTREAM_NOT_READY');

INSERT INTO batch.workflow_launch_wait
  (tenant_id, request_id, workflow_definition_id, biz_date, dry_run, launch_payload,
   wait_status, attempt_count, next_attempt_at)
VALUES
  (:'tenant_id', :'capacity_request_id', :'workflow_definition_id'::bigint,
   :'biz_date'::date, true,
   jsonb_build_object('privateMarker', 'PERSISTENT_WAIT_PRIVATE_PAYLOAD', 'tenantId', :'tenant_id'),
   'WAITING', 3, current_timestamp + interval '2 minutes');

SELECT json_build_object(
  'readinessCount', (SELECT count(*) FROM batch.readiness_wait
                      WHERE tenant_id = :'tenant_id' AND request_id = :'readiness_request_id'),
  'capacityCount', (SELECT count(*) FROM batch.workflow_launch_wait
                     WHERE tenant_id = :'tenant_id' AND request_id = :'capacity_request_id'));
COMMIT;

-- 删除限制到本例租户、已保存 Workflow ID 和四个随机请求号。
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15s';
SET LOCAL app.tenant_id = :'tenant_id';
CREATE TEMP TABLE owned_wait_parent_run ON COMMIT DROP AS
SELECT run.id
  FROM batch.workflow_run run
  JOIN batch.trigger_request parent ON parent.tenant_id = run.tenant_id
                                   AND parent.id = run.trigger_request_id
 WHERE parent.tenant_id = :'tenant_id' AND parent.request_id = :'job_wait_parent_request_id';
DELETE FROM batch.job_dependency_waiting_launch
 WHERE tenant_id = :'tenant_id' AND request_id = :'job_wait_request_id';
DELETE FROM batch.trigger_request
 WHERE tenant_id = :'tenant_id' AND request_id = :'job_wait_request_id';
DELETE FROM batch.workflow_run
 WHERE tenant_id = :'tenant_id' AND id IN (SELECT id FROM owned_wait_parent_run);
DELETE FROM batch.trigger_request
 WHERE tenant_id = :'tenant_id' AND request_id = :'job_wait_parent_request_id';
DELETE FROM batch.workflow_launch_wait
 WHERE tenant_id = :'tenant_id'
   AND workflow_definition_id = :'workflow_definition_id'::bigint
   AND request_id = :'capacity_request_id';
DELETE FROM batch.readiness_wait
 WHERE tenant_id = :'tenant_id'
   AND workflow_definition_id = :'workflow_definition_id'::bigint
   AND request_id = :'readiness_request_id';
SELECT json_build_object(
  'jobDependencyRowsRemaining', (SELECT count(*) FROM batch.job_dependency_waiting_launch
                                  WHERE tenant_id = :'tenant_id' AND request_id = :'job_wait_request_id'),
  'jobRequestRowsRemaining', (SELECT count(*) FROM batch.trigger_request
                               WHERE tenant_id = :'tenant_id' AND request_id = :'job_wait_request_id'),
  'jobParentRequestRowsRemaining', (SELECT count(*) FROM batch.trigger_request
                                     WHERE tenant_id = :'tenant_id' AND request_id = :'job_wait_parent_request_id'),
  'jobParentRunRowsRemaining', (SELECT count(*) FROM batch.workflow_run
                                 WHERE tenant_id = :'tenant_id' AND id IN (SELECT id FROM owned_wait_parent_run)),
  'readinessRowsRemaining', (SELECT count(*) FROM batch.readiness_wait
                              WHERE tenant_id = :'tenant_id'
                                AND workflow_definition_id = :'workflow_definition_id'::bigint
                                AND request_id = :'readiness_request_id'),
  'capacityRowsRemaining', (SELECT count(*) FROM batch.workflow_launch_wait
                             WHERE tenant_id = :'tenant_id'
                               AND workflow_definition_id = :'workflow_definition_id'::bigint
                               AND request_id = :'capacity_request_id'));
COMMIT;

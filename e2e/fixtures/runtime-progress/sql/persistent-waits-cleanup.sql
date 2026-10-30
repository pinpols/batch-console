-- 删除限制到本例租户、已保存Workflow ID和两个随机请求号。
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15s';
SET LOCAL app.tenant_id = :'tenant_id';
DELETE FROM batch.workflow_launch_wait
 WHERE tenant_id = :'tenant_id'
   AND workflow_definition_id = :'workflow_definition_id'::bigint
   AND request_id = :'capacity_request_id';
DELETE FROM batch.readiness_wait
 WHERE tenant_id = :'tenant_id'
   AND workflow_definition_id = :'workflow_definition_id'::bigint
   AND request_id = :'readiness_request_id';
SELECT json_build_object(
  'readinessRowsRemaining', (SELECT count(*) FROM batch.readiness_wait
                              WHERE tenant_id = :'tenant_id'
                                AND workflow_definition_id = :'workflow_definition_id'::bigint
                                AND request_id = :'readiness_request_id'),
  'capacityRowsRemaining', (SELECT count(*) FROM batch.workflow_launch_wait
                             WHERE tenant_id = :'tenant_id'
                               AND workflow_definition_id = :'workflow_definition_id'::bigint
                               AND request_id = :'capacity_request_id'));
COMMIT;

-- 独立回读本例全部定义、原始计划、水位、业务日与实际根运行，不写状态。
BEGIN;
SET LOCAL app.tenant_id = :'tenant_id';
SELECT json_build_object(
  'definitions', (SELECT coalesce(json_agg(json_build_object(
    'id', id, 'code', workflow_code, 'version', version, 'scheduleType', schedule_type,
    'calendarCode', calendar_code, 'enabled', enabled, 'scheduleEnabled', schedule_enabled
  ) ORDER BY id), '[]'::json) FROM batch.workflow_definition WHERE tenant_id = :'tenant_id'),
  'occurrences', (SELECT coalesce(json_agg(json_build_object(
    'workflowId', workflow_definition_id, 'status', occurrence_status, 'bizDate', biz_date,
    'fireTime', scheduled_fire_time, 'calendarCode', calendar_code, 'requestId', request_id
  ) ORDER BY scheduled_fire_time, id), '[]'::json) FROM batch.scheduled_occurrence
    WHERE tenant_id = :'tenant_id' AND occurrence_status != 'SUPERSEDED'),
  'coverage', (SELECT coalesce(json_agg(json_build_object(
    'workflowId', workflow_definition_id, 'calendarCode', calendar_code,
    'scheduleVersion', schedule_version, 'from', coverage_from_at,
    'through', coverage_through_at, 'lastSuccessAt', last_success_at
  ) ORDER BY workflow_definition_id), '[]'::json) FROM batch.scheduled_occurrence_coverage
    WHERE tenant_id = :'tenant_id'),
  'days', (SELECT coalesce(json_agg(json_build_object(
    'calendarCode', calendar_code, 'bizDate', biz_date, 'status', day_status,
    'cutoffAt', cutoff_at
  ) ORDER BY calendar_code, biz_date), '[]'::json) FROM batch.batch_day_instance
    WHERE tenant_id = :'tenant_id'),
  'runs', (SELECT coalesce(json_agg(json_build_object(
    'id', id, 'workflowId', workflow_definition_id, 'bizDate', biz_date,
    'status', run_status, 'triggerRequestId', trigger_request_id
  ) ORDER BY id), '[]'::json) FROM batch.workflow_run WHERE tenant_id = :'tenant_id'),
  'requests', (SELECT coalesce(json_agg(json_build_object(
    'id', id, 'requestId', request_id, 'workflowId', workflow_definition_id,
    'bizDate', biz_date, 'status', request_status
  ) ORDER BY id), '[]'::json) FROM batch.trigger_request
    WHERE tenant_id = :'tenant_id' AND parent_workflow_run_id IS NULL),
  'jobInstances', (SELECT count(*) FROM batch.job_instance WHERE tenant_id = :'tenant_id')
);
COMMIT;

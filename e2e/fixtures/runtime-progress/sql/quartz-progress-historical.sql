-- 模拟迁移前已有的历史投影，不写入实际触发事件，也不模拟任何真实调度行为。
BEGIN;
SET LOCAL app.tenant_id = :'tenant_id';
WITH existing AS (
    SELECT tenant_id, workflow_definition_id, workflow_code, schedule_version, calendar_code,
           scheduled_fire_time, biz_date
      FROM batch.scheduled_occurrence
     WHERE tenant_id = :'tenant_id'
       AND workflow_definition_id = NULLIF(:'workflow_definition_id', '0')::bigint
     ORDER BY scheduled_fire_time
     LIMIT 1
), inserted AS (
    INSERT INTO batch.scheduled_occurrence
        (tenant_id, workflow_definition_id, workflow_code, schedule_version, calendar_code,
         scheduled_fire_time, biz_date, occurrence_status)
    SELECT tenant_id, workflow_definition_id, workflow_code, schedule_version, calendar_code,
           scheduled_fire_time - interval '5 seconds', biz_date, 'REQUESTED'
      FROM existing
    RETURNING scheduled_fire_time
)
SELECT json_build_object('insertedRows', count(*), 'scheduledFireTime', min(scheduled_fire_time))
  FROM inserted;
COMMIT;

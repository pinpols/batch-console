BEGIN;
SET LOCAL app.tenant_id = :'tenant_id';

WITH changed AS (
  UPDATE batch.calendar_dependency_wait
     SET last_checked_at = CURRENT_TIMESTAMP - INTERVAL '1 minute',
         updated_at = CURRENT_TIMESTAMP
   WHERE tenant_id = :'tenant_id'
     AND calendar_code = :'calendar_code'
     AND biz_date = :'calendar_biz_date'
     AND wait_status = 'WAITING'
     AND manual_action = 'RELEASE'
  RETURNING 1
)
SELECT json_build_object('updatedRows', count(*)) FROM changed;

COMMIT;

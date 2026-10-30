BEGIN;
SET LOCAL app.tenant_id = :'tenant_id';
WITH updated AS (
    UPDATE batch.business_calendar
       SET timezone = 'Asia/Shanghai'
     WHERE tenant_id = :'tenant_id' AND calendar_code = :'calendar_code'
     RETURNING 1
)
SELECT json_build_object('updatedRows', count(*)::integer) FROM updated;
COMMIT;

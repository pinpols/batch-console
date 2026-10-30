-- 只准备本例第二日历，cutoff与主日历一致；业务日运行仍由真实调度器创建。
BEGIN;
SET LOCAL app.tenant_id = :'tenant_id';
INSERT INTO batch.business_calendar
  (tenant_id, calendar_code, calendar_name, timezone, cutoff_time, holiday_roll_rule)
SELECT tenant_id, :'second_calendar_code', 'Secondary daily progress calendar',
       timezone, cutoff_time, holiday_roll_rule
  FROM batch.business_calendar
 WHERE tenant_id = :'tenant_id' AND calendar_code = :'calendar_code';
COMMIT;
SELECT json_build_object('calendars', count(*)) FROM batch.business_calendar
 WHERE tenant_id = :'tenant_id'
   AND calendar_code IN (:'calendar_code', :'second_calendar_code');

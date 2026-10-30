-- 只创建本例唯一租户与日历，为手工 Workflow 提供完整业务日身份。
BEGIN;
INSERT INTO batch.tenant (tenant_id, tenant_name, status)
VALUES (:'tenant_id', :'tenant_id', 'ACTIVE');
INSERT INTO batch.business_calendar (tenant_id, calendar_code, calendar_name, timezone)
VALUES (:'tenant_id', :'calendar_code', 'Bulk browser calendar', 'UTC');
COMMIT;

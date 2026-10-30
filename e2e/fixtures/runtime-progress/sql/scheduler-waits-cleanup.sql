BEGIN;
SET LOCAL app.tenant_id = :'tenant_id';
DELETE FROM batch.job_dependency_waiting_launch
 WHERE tenant_id = :'tenant_id' AND job_code = :'job_code' AND biz_date = :'job_biz_date';
DELETE FROM batch.calendar_dependency_wait
 WHERE tenant_id = :'tenant_id' AND calendar_code = :'calendar_code' AND biz_date = :'calendar_biz_date';
DELETE FROM batch.calendar_dependency_wait
 WHERE tenant_id = :'tenant_id' AND calendar_code = :'calendar_code' AND biz_date = :'release_biz_date';
DELETE FROM batch.batch_day_operation_audit
 WHERE tenant_id = :'tenant_id' AND calendar_code = :'calendar_code'
   AND biz_date IN (:'calendar_biz_date', :'release_biz_date');
DELETE FROM batch.batch_day_instance
 WHERE tenant_id = :'tenant_id' AND calendar_code = :'calendar_code'
   AND biz_date IN (:'calendar_biz_date', :'release_biz_date');
COMMIT;

SELECT json_build_object(
  'calendarWaitRowsRemaining', (SELECT count(*) FROM batch.calendar_dependency_wait
                                 WHERE tenant_id = :'tenant_id'
                                   AND calendar_code = :'calendar_code'
                                   AND biz_date IN (:'calendar_biz_date', :'release_biz_date')),
  'jobWaitRowsRemaining', (SELECT count(*) FROM batch.job_dependency_waiting_launch
                            WHERE tenant_id = :'tenant_id' AND job_code = :'job_code'),
  'batchDays', (SELECT count(*) FROM batch.batch_day_instance
                 WHERE tenant_id = :'tenant_id' AND calendar_code = :'calendar_code'
                   AND biz_date IN (:'calendar_biz_date', :'release_biz_date')),
  'operationAudits', (SELECT count(*) FROM batch.batch_day_operation_audit
                       WHERE tenant_id = :'tenant_id' AND calendar_code = :'calendar_code'
                         AND biz_date IN (:'calendar_biz_date', :'release_biz_date'))
);

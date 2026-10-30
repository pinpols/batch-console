BEGIN;
SET LOCAL app.tenant_id = :'tenant_id';

INSERT INTO batch.calendar_dependency_wait (
  tenant_id, calendar_code, biz_date, wait_status, blocked_reason,
  first_waiting_at, last_checked_at, attempt_count, cutoff_at, sla_deadline_at,
  timezone_snapshot, dst_policy_snapshot, dependency_snapshot
)
VALUES (
  :'tenant_id', :'calendar_code', :'calendar_biz_date', 'WAITING', 'UPSTREAM_BATCH_DAY_OPEN',
  CURRENT_TIMESTAMP - INTERVAL '5 minutes', CURRENT_TIMESTAMP + INTERVAL '1 hour', 3,
  CURRENT_TIMESTAMP + INTERVAL '2 hours', CURRENT_TIMESTAMP + INTERVAL '3 hours',
  'UTC', 'EARLIER_OFFSET', '[{"calendarCode":"upstream-calendar","waitStatus":"WAITING"}]'::jsonb
);

SELECT json_build_object(
  'calendarRows', (SELECT count(*) FROM batch.calendar_dependency_wait
                    WHERE tenant_id = :'tenant_id' AND calendar_code = :'calendar_code'
                      AND biz_date = :'calendar_biz_date' AND wait_status = 'WAITING')
);
COMMIT;

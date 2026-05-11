-- seed-outbox-stuck.sql
-- 在 ta 租户造 3 条卡住 outbox 事件,测 republish / cleanup。
-- 真实表名:batch.outbox_event
-- 真实字段:
--   tenant_id, aggregate_type, aggregate_id (BIGINT), event_type, event_key (uniq)
--   payload_json (jsonb), publish_status, publish_attempt, next_publish_at, trace_id
-- 状态枚举(ck_outbox_publish_status):
--   NEW / PUBLISHING / PUBLISHED / FAILED / GIVE_UP
-- 注:**没有 STUCK 枚举值**,旧 FE 文案"STUCK"对应 BE 的 FAILED + publish_attempt>=阈值
--
-- 用法:  psql -h localhost -p 15432 -U batch -d batch_console -f seed-outbox-stuck.sql
-- 清理:  DELETE FROM batch.outbox_event WHERE event_key LIKE 'e2e-stuck-%';

BEGIN;

INSERT INTO batch.outbox_event (
  tenant_id, aggregate_type, aggregate_id, event_type, event_key,
  payload_json, publish_status, publish_attempt, next_publish_at, trace_id
) VALUES
  ('ta', 'JOB_INSTANCE', 1001, 'JOB_TRIGGERED', 'e2e-stuck-1',
   '{"jobCode":"TA_INC_ORDER_AGG","bizDate":"2026-05-01"}'::jsonb,
   'FAILED', 5, NOW() - INTERVAL '2 hours', 'e2e-trace-outbox-1'),

  ('ta', 'JOB_INSTANCE', 1002, 'JOB_FAILED', 'e2e-stuck-2',
   '{"jobCode":"TA_INC_ORDER_AGG","reason":"timeout"}'::jsonb,
   'FAILED', 5, NOW() - INTERVAL '1 hour', 'e2e-trace-outbox-2'),

  ('ta', 'FILE', 1, 'FILE_ARRIVED', 'e2e-stuck-3',
   '{"fileId":"f-1","template":"orders"}'::jsonb,
   'GIVE_UP', 10, NOW() - INTERVAL '6 hours', 'e2e-trace-outbox-3');

COMMIT;

-- 验证:
-- SELECT event_key, publish_status, publish_attempt FROM batch.outbox_event
--   WHERE event_key LIKE 'e2e-stuck-%';

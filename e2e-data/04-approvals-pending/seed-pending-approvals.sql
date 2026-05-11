-- seed-pending-approvals.sql
-- 造 PENDING approval 用于 e2e 测试 approve / reject 流程。
-- 真实表名:
--   batch.approval_command       — 通用业务审批(catch-up / compensation / dlq-replay / download)
--   batch.config_approval        — 配置发布审批
--
-- approval_type 枚举(ck_approval_command_type):
--   CATCH_UP / COMPENSATION / DLQ_REPLAY / DOWNLOAD
-- approval_status 枚举:PENDING / APPROVED / REJECTED / EXECUTED
--
-- 用法:  psql -h localhost -p 15432 -U batch -d batch_console -f seed-pending-approvals.sql
-- 清理:  DELETE FROM batch.approval_command WHERE approval_no LIKE 'e2e-%';
--        DELETE FROM batch.config_approval WHERE release_id IN (SELECT id FROM batch.config_release WHERE config_key LIKE 'e2e-%');

BEGIN;

-- 1. Catch-up approval(测 /approvals?tab=catch-up 的 approve/reject)
INSERT INTO batch.approval_command (
  tenant_id, approval_no, approval_type, action_type, target_type, target_id,
  payload_json, approval_status, requester_id, source_trace_id
) VALUES (
  'ta', 'e2e-pending-catchup-1', 'CATCH_UP', 'CATCH_UP', 'JOB_DEFINITION', 'TA_INC_ORDER_AGG',
  '{"bizDate":"2026-04-30","reason":"e2e 补登测试"}'::jsonb,
  'PENDING', 'e2e-tester', 'e2e-trace-catchup-1'
);

-- 2. Compensation approval(测通用审批 tab)
INSERT INTO batch.approval_command (
  tenant_id, approval_no, approval_type, action_type, target_type, target_id,
  payload_json, approval_status, requester_id, source_trace_id
) VALUES (
  'ta', 'e2e-pending-comp-1', 'COMPENSATION', 'COMPENSATION', 'JOB_INSTANCE', '0',
  '{"jobCode":"TA_INC_ORDER_AGG","bizDate":"2026-04-29","reason":"e2e compensation 测试"}'::jsonb,
  'PENDING', 'e2e-tester', 'e2e-trace-comp-1'
);

-- 3. DLQ replay approval
INSERT INTO batch.approval_command (
  tenant_id, approval_no, approval_type, action_type, target_type, target_id,
  payload_json, approval_status, requester_id, source_trace_id
) VALUES (
  'ta', 'e2e-pending-dlq-1', 'DLQ_REPLAY', 'DLQ_REPLAY', 'OUTBOX_EVENT', '0',
  '{"eventIds":[1001,1002],"reason":"e2e DLQ 测试"}'::jsonb,
  'PENDING', 'e2e-tester', 'e2e-trace-dlq-1'
);

COMMIT;

-- 验证:
-- SELECT approval_no, approval_type, approval_status FROM batch.approval_command
--   WHERE approval_no LIKE 'e2e-%' ORDER BY id;

# 07 — Outbox 卡住消息

## 测的接口
- POST `/api/console/ops/outbox/republish`
- POST `/api/console/ops/outbox/cleanup`

## 数据
**只能 BE SQL seed**(FE 不会主动产生 STUCK 状态):

```sql
-- 让 BE 同事执行(seed-outbox.sql 待补)
INSERT INTO outbox_event (
  event_id, aggregate_id, event_type, payload,
  status, retry_count, created_at
) VALUES
  ('test-stuck-1', 'job-001', 'JOB_TRIGGERED', '{}', 'STUCK', 5, NOW() - INTERVAL '2 hours'),
  ('test-stuck-2', 'job-002', 'JOB_FAILED',     '{}', 'STUCK', 5, NOW() - INTERVAL '1 hour');
```

## FE 触发路径
**观测查询 → 综合查询 → Outbox tab**(或 ops 域内入口)

## 验证点
- 列表能筛 STUCK
- 行内 republish:状态切回 PENDING
- 顶部 cleanup:批量软删

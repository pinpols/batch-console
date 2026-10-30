-- 认证登出亦生成幂等记录；父夹具收尾后只清理本例随机租户的传输去重信息。
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DELETE FROM batch.event_delivery_log WHERE tenant_id = :'tenant_id';
DELETE FROM batch.event_outbox_retry WHERE tenant_id = :'tenant_id';
DELETE FROM batch.outbox_event_dedup_key WHERE tenant_id = :'tenant_id';
DELETE FROM batch.outbox_event WHERE tenant_id = :'tenant_id';
DELETE FROM batch.data_asset WHERE tenant_id = :'tenant_id';
DELETE FROM batch.idempotency_record WHERE tenant_id = :'tenant_id';
DELETE FROM batch.console_push_approval_notification WHERE tenant_id = :'tenant_id';
DELETE FROM batch.console_usage_daily WHERE tenant_id = :'tenant_id';
DELETE FROM batch.dead_letter_task WHERE tenant_id = :'tenant_id';
DELETE FROM batch.job_execution_log WHERE tenant_id = :'tenant_id';
DELETE FROM batch.job_instance_dedup_key WHERE tenant_id = :'tenant_id';
DELETE FROM batch.alert_event WHERE tenant_id = :'tenant_id';
COMMIT;
SELECT json_build_object(
  'idempotencyRows', (SELECT count(*) FROM batch.idempotency_record WHERE tenant_id = :'tenant_id'),
  'lateApprovalNotifications', (SELECT count(*) FROM batch.console_push_approval_notification WHERE tenant_id = :'tenant_id'),
  'usageRows', (SELECT count(*) FROM batch.console_usage_daily WHERE tenant_id = :'tenant_id'),
  'deadLetters', (SELECT count(*) FROM batch.dead_letter_task WHERE tenant_id = :'tenant_id'),
  'finalExecutionLogs', (SELECT count(*) FROM batch.job_execution_log WHERE tenant_id = :'tenant_id'),
  'finalJobDedupKeys', (SELECT count(*) FROM batch.job_instance_dedup_key WHERE tenant_id = :'tenant_id'),
  'alertRows', (SELECT count(*) FROM batch.alert_event WHERE tenant_id = :'tenant_id'),
  'remainingEventDeliveries', (SELECT count(*) FROM batch.event_delivery_log WHERE tenant_id = :'tenant_id'),
  'remainingEventRetries', (SELECT count(*) FROM batch.event_outbox_retry WHERE tenant_id = :'tenant_id'),
  'remainingEventKeys', (SELECT count(*) FROM batch.outbox_event_dedup_key WHERE tenant_id = :'tenant_id'),
  'remainingEvents', (SELECT count(*) FROM batch.outbox_event WHERE tenant_id = :'tenant_id'),
  'remainingAssets', (SELECT count(*) FROM batch.data_asset WHERE tenant_id = :'tenant_id')
);

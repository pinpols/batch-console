-- 只删本例生成的三个租户及其事实；不调用全局前缀清理端点。
BEGIN;
DROP TRIGGER IF EXISTS :"fault_name" ON batch.config_sync_log;
DROP FUNCTION IF EXISTS batch.:"fault_name"();
DELETE FROM batch.config_sync_target_receipt WHERE audit_tenant_id = :'tenant_id';
DELETE FROM batch.config_sync_log WHERE tenant_id = :'tenant_id';
DELETE FROM batch.console_operation_audit WHERE tenant_id = :'tenant_id';
DELETE FROM archive.console_operation_audit_archive WHERE tenant_id = :'tenant_id';
DELETE FROM batch.notification_delivery_log WHERE tenant_id = :'tenant_id';
DELETE FROM archive.notification_delivery_log_archive WHERE tenant_id = :'tenant_id';
DELETE FROM batch.workflow_terminal_notification_receipt WHERE tenant_id = :'tenant_id';
DELETE FROM archive.workflow_terminal_notification_receipt_archive WHERE tenant_id = :'tenant_id';
DELETE FROM batch.subscription_rule WHERE tenant_id = :'tenant_id';
DELETE FROM batch.notification_channel WHERE tenant_id = :'tenant_id';
DELETE FROM batch.resource_queue WHERE tenant_id IN (:'target_a', :'target_b');
DELETE FROM batch.tenant_configuration_revision WHERE tenant_id IN (:'tenant_id', :'target_a', :'target_b');
DELETE FROM batch.tenant WHERE tenant_id IN (:'tenant_id', :'target_a', :'target_b');
COMMIT;
SELECT
    (SELECT count(*) FROM batch.tenant WHERE tenant_id IN (:'tenant_id', :'target_a', :'target_b'))
  + (SELECT count(*) FROM batch.tenant_configuration_revision
      WHERE tenant_id IN (:'tenant_id', :'target_a', :'target_b'))
  + (SELECT count(*) FROM batch.config_sync_target_receipt WHERE audit_tenant_id = :'tenant_id')
  + (SELECT count(*) FROM batch.config_sync_log WHERE tenant_id = :'tenant_id')
  + (SELECT count(*) FROM batch.console_operation_audit WHERE tenant_id = :'tenant_id')
  + (SELECT count(*) FROM archive.console_operation_audit_archive WHERE tenant_id = :'tenant_id')
  + (SELECT count(*) FROM batch.notification_delivery_log WHERE tenant_id = :'tenant_id')
  + (SELECT count(*) FROM archive.notification_delivery_log_archive WHERE tenant_id = :'tenant_id')
  + (SELECT count(*) FROM batch.workflow_terminal_notification_receipt WHERE tenant_id = :'tenant_id')
  + (SELECT count(*) FROM archive.workflow_terminal_notification_receipt_archive WHERE tenant_id = :'tenant_id')
  + (SELECT count(*) FROM batch.subscription_rule WHERE tenant_id = :'tenant_id')
  + (SELECT count(*) FROM batch.notification_channel WHERE tenant_id = :'tenant_id')
  + (SELECT count(*) FROM batch.resource_queue WHERE tenant_id IN (:'target_a', :'target_b'))
  + (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'batch' AND p.proname = :'fault_name');

BEGIN;
DELETE FROM batch.subscription_rule WHERE tenant_id IN (:'tenant_id', :'other_tenant_id');
DELETE FROM batch.notification_channel WHERE tenant_id IN (:'tenant_id', :'other_tenant_id');
DELETE FROM batch.webhook_subscription WHERE tenant_id IN (:'tenant_id', :'other_tenant_id');
COMMIT;
SELECT json_build_object(
  'rules', (SELECT count(*) FROM batch.subscription_rule WHERE tenant_id IN (:'tenant_id', :'other_tenant_id')),
  'channels', (SELECT count(*) FROM batch.notification_channel WHERE tenant_id IN (:'tenant_id', :'other_tenant_id')),
  'webhooks', (SELECT count(*) FROM batch.webhook_subscription WHERE tenant_id IN (:'tenant_id', :'other_tenant_id'))
);

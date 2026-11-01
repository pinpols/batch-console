SELECT json_build_object(
  'notificationDeliveries', (SELECT count(*) FROM batch.notification_delivery_log WHERE tenant_id = :'tenant_id'),
  'webhookDeliveries', (SELECT count(*) FROM batch.webhook_delivery_log WHERE tenant_id = :'tenant_id'),
  'terminalReceipts', (SELECT count(*) FROM batch.workflow_terminal_notification_receipt WHERE tenant_id = :'tenant_id'),
  'terminalJobDeliveries', (SELECT count(*) FROM batch.console_push_job_delivery WHERE tenant_id = :'tenant_id'),
  'ruleState', (SELECT json_agg(json_build_array(rule_name, enabled) ORDER BY rule_name) FROM batch.subscription_rule WHERE tenant_id = :'tenant_id'),
  'channelState', (SELECT json_agg(json_build_array(channel_code, enabled) ORDER BY channel_code) FROM batch.notification_channel WHERE tenant_id = :'tenant_id'),
  'webhookState', (SELECT json_agg(json_build_array(name, enabled) ORDER BY name) FROM batch.webhook_subscription WHERE tenant_id = :'tenant_id')
);

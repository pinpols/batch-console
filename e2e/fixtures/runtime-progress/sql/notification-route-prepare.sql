BEGIN;
INSERT INTO batch.notification_channel (tenant_id, channel_code, channel_name, channel_type, config_json, enabled)
VALUES (:'tenant_id', 'route-enabled', 'Enabled', 'WEBHOOK', '{"url":"PRIVATE_CHANNEL_URL"}', true),
       (:'tenant_id', 'route-disabled', 'Disabled', 'WEBHOOK', '{}', false),
       (:'other_tenant_id', 'route-enabled', 'Other tenant', 'WEBHOOK', '{}', true);
INSERT INTO batch.subscription_rule (tenant_id, rule_name, channel_code, event_types, job_code_filter, enabled)
VALUES (:'tenant_id', 'route-match', 'route-enabled', 'JOB_FAILED', 'job-match', true),
       (:'tenant_id', 'route-mismatch', 'route-enabled', 'JOB_FAILED', 'other-job', true),
       (:'tenant_id', 'route-disabled-channel', 'route-disabled', 'JOB_FAILED', 'job-match', true),
       (:'tenant_id', 'route-missing-channel', 'route-missing', 'JOB_FAILED', 'job-match', true),
       (:'tenant_id', 'route-disabled-rule', 'route-enabled', 'JOB_FAILED', 'job-match', false),
       (:'other_tenant_id', 'route-other-tenant', 'route-enabled', 'JOB_FAILED', 'job-match', true);
INSERT INTO batch.subscription_rule (tenant_id, rule_name, channel_code, event_types, severity_filter, enabled)
VALUES (:'tenant_id', 'route-alert-error', 'route-enabled', 'ALERT_ESCALATED', 'ERROR', true),
       (:'tenant_id', 'route-alert-warn', 'route-enabled', 'ALERT_ESCALATED', 'WARN', true);
INSERT INTO batch.webhook_subscription (tenant_id, name, callback_url, secret, event_types, enabled)
VALUES (:'tenant_id', 'webhook-match', 'https://private.invalid/hook', 'PRIVATE_WEBHOOK_SECRET', 'JOB_FAILED', true),
       (:'tenant_id', 'webhook-disabled', 'https://private.invalid/hook', 'PRIVATE_WEBHOOK_SECRET', 'JOB_FAILED', false),
       (:'tenant_id', 'webhook-other-event', 'https://private.invalid/hook', 'PRIVATE_WEBHOOK_SECRET', 'WORKFLOW_SUCCESS', true),
       (:'other_tenant_id', 'webhook-other-tenant', 'https://private.invalid/hook', 'PRIVATE_WEBHOOK_SECRET', 'JOB_FAILED', true);
COMMIT;
SELECT json_build_object('ready', true);

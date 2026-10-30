-- 直接准备热/冷历史以验证浏览器读取和人工恢复；不声称此夹具证明生产归档器。
-- 规则与渠道停用，人工排队后也不会向外部收件端发送请求。
BEGIN;
SET LOCAL app.tenant_id = :'tenant_id';
INSERT INTO batch.notification_channel
    (tenant_id, channel_code, channel_name, channel_type, config_json, enabled)
VALUES (:'tenant_id', :'queue_code', 'Closure browser fixture', 'EMAIL', '{}', false);
INSERT INTO batch.subscription_rule
    (tenant_id, rule_name, channel_code, event_types, enabled)
VALUES (:'tenant_id', :'queue_code', :'queue_code', 'WORKFLOW_FAILED', false)
RETURNING id AS rule_id \gset
INSERT INTO batch.workflow_terminal_notification_receipt (tenant_id, event_key, payload_json)
VALUES (:'tenant_id', :'hot_event', '{}');
INSERT INTO batch.notification_delivery_log
    (tenant_id, rule_id, channel_code, terminal_event_key, event_type, payload_json,
     delivery_status, attempt, next_retry_at)
VALUES (:'tenant_id', :'rule_id', :'queue_code', :'hot_event', 'WORKFLOW_FAILED', '{}',
        'EXHAUSTED', 1, NULL)
RETURNING id AS hot_id \gset
INSERT INTO archive.workflow_terminal_notification_receipt_archive
    (tenant_id, event_key, payload_json)
VALUES (:'tenant_id', :'cold_event', '{}');
INSERT INTO archive.notification_delivery_log_archive
    (id, tenant_id, rule_id, channel_code, terminal_event_key, event_type, payload_json,
     delivery_status, attempt)
VALUES (nextval(pg_get_serial_sequence('batch.notification_delivery_log', 'id')),
        :'tenant_id', :'rule_id', :'queue_code', :'cold_event', 'WORKFLOW_FAILED', '{}',
        'SUCCESS', 1)
RETURNING id AS cold_id \gset
SELECT json_build_object('hotId', :'hot_id'::bigint, 'coldId', :'cold_id'::bigint);
COMMIT;

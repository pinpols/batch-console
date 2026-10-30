SELECT json_build_object(
    'hotCount', (SELECT count(*) FROM batch.notification_delivery_log
                 WHERE tenant_id = :'tenant_id' AND terminal_event_key = :'hot_event'),
    'coldCount', (SELECT count(*) FROM archive.notification_delivery_log_archive
                  WHERE tenant_id = :'tenant_id' AND terminal_event_key = :'cold_event'),
    'auditCount', (SELECT count(*) FROM batch.console_operation_audit
                   WHERE tenant_id = :'tenant_id' AND aggregate_type = 'NOTIFICATION_DELIVERY'
                     AND action = 'NOTIFICATION_DELIVERY_RETRY'),
    'evidence', (SELECT params FROM batch.console_operation_audit
                 WHERE tenant_id = :'tenant_id' AND aggregate_type = 'NOTIFICATION_DELIVERY'
                   AND action = 'NOTIFICATION_DELIVERY_RETRY')
);

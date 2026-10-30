SELECT json_build_object(
    'logId', (SELECT id FROM batch.config_sync_log WHERE tenant_id = :'tenant_id'),
    'status', (SELECT sync_status FROM batch.config_sync_log WHERE tenant_id = :'tenant_id'),
    'successItems', (SELECT success_items FROM batch.config_sync_log WHERE tenant_id = :'tenant_id'),
    'skippedItems', (SELECT skipped_items FROM batch.config_sync_log WHERE tenant_id = :'tenant_id'),
    'reconciledBy', (SELECT detail_json->>'reconciledBy'
                    FROM batch.config_sync_log WHERE tenant_id = :'tenant_id'),
    'configCount', (SELECT count(*) FROM batch.resource_queue
                    WHERE tenant_id IN (:'target_a', :'target_b') AND queue_code = :'queue_code'),
    'receiptCount', (SELECT count(*) FROM batch.config_sync_target_receipt
                     WHERE audit_tenant_id = :'tenant_id'),
    'receiptResults', (SELECT jsonb_agg(result_json ORDER BY tenant_id)
                       FROM batch.config_sync_target_receipt WHERE audit_tenant_id = :'tenant_id')
);

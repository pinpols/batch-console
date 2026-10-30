-- 仅创建本用例生成的三个唯一租户；不复用或修改共享 ta/tb 配置。
BEGIN;
DO $$
BEGIN
    IF to_regclass('batch.config_sync_target_receipt') IS NULL
       OR to_regclass('archive.notification_delivery_log_archive') IS NULL THEN
        RAISE EXCEPTION 'closure browser acceptance requires migrations V345 and V346';
    END IF;
END;
$$;
INSERT INTO batch.tenant (tenant_id, tenant_name, status)
VALUES (:'tenant_id', :'tenant_id', 'ACTIVE'),
       (:'target_a', :'target_a', 'ACTIVE'),
       (:'target_b', :'target_b', 'ACTIVE');
COMMIT;

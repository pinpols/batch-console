-- 调用方已确认平台Job/Task终态；这里只清理本例业务库、批次和随机关系。
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DELETE FROM batch.process_staging WHERE tenant_id = :'tenant_id' AND batch_key = :'batch_key';
DELETE FROM batch.process_staging_generation WHERE tenant_id = :'tenant_id' AND batch_key = :'batch_key';
SELECT format('DROP TABLE biz.%I', :'target_table') \gexec
SELECT format('DROP TABLE biz.%I', :'source_table') \gexec
SELECT format('DROP FUNCTION biz.%I()', :'pause_function') \gexec
COMMIT;
SELECT json_build_object(
  'processStagingRows', (SELECT count(*) FROM batch.process_staging WHERE tenant_id = :'tenant_id'),
  'processGenerations', (SELECT count(*) FROM batch.process_staging_generation WHERE tenant_id = :'tenant_id'),
  'processBusinessTables', (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'biz' AND table_name IN (:'source_table', :'target_table')),
  'processPauseFunctions', (SELECT count(*) FROM pg_proc proc JOIN pg_namespace ns ON ns.oid = proc.pronamespace WHERE ns.nspname = 'biz' AND proc.proname = :'pause_function')
);

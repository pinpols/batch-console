-- 仅删除本例保存键对应的结果版本；父夹具随后按独占租户清理审计与身份。
BEGIN;
SET LOCAL lock_timeout = '5s';
WITH deleted AS (
  DELETE FROM batch.result_version
  WHERE tenant_id = :'tenant_id'
    AND business_key IN (:'effective_business_key', :'archived_business_key', :'admin_archived_business_key')
  RETURNING id
)
SELECT json_build_object(
  'resultVersionsDeleted', (SELECT count(*) FROM deleted),
  'resultVersionRowsRemaining', (
    SELECT count(*)
    FROM batch.result_version
    WHERE tenant_id = :'tenant_id'
      AND business_key IN (:'effective_business_key', :'archived_business_key', :'admin_archived_business_key')
  ) - (SELECT count(*) FROM deleted)
);
COMMIT;

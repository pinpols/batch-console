-- 独立核对本例结果版本及 Console 审计，不读取共享租户数据。
BEGIN;
SELECT set_config('app.tenant_id', :'tenant_id', true) AS ignored \gset
SELECT json_build_object(
  'versions', coalesce((
    SELECT json_agg(json_build_object(
      'id', id,
      'businessKey', business_key,
      'versionNo', version_no,
      'status', status,
      'jobInstanceId', job_instance_id,
      'payloadJson', payload_json::text
    ) ORDER BY business_key, version_no)
    FROM batch.result_version
    WHERE tenant_id = :'tenant_id'
      AND business_key IN (:'effective_business_key', :'archived_business_key', :'admin_archived_business_key')
  ), '[]'::json),
  'currentEffectiveCount', (
    SELECT count(*)
    FROM batch.result_version
    WHERE tenant_id = :'tenant_id'
      AND business_key = :'effective_business_key'
      AND status = 'EFFECTIVE'
  ),
  'audits', coalesce((
    SELECT json_agg(json_build_object(
      'aggregateId', aggregate_id,
      'action', action,
      'tenantId', tenant_id,
      'operatorId', operator_id,
      'result', result
    ) ORDER BY created_at, id)
    FROM batch.console_operation_audit
    WHERE tenant_id = :'tenant_id'
      AND aggregate_type = 'result_version'
      AND action IN ('result_version.promote', 'result_version.reject')
      AND aggregate_id IN (
        SELECT id::text
        FROM batch.result_version
        WHERE tenant_id = :'tenant_id'
          AND business_key IN (:'effective_business_key', :'archived_business_key', :'admin_archived_business_key')
      )
  ), '[]'::json)
);
COMMIT;

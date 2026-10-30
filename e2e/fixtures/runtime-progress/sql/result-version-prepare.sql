-- 准备独占结果版本记录；状态流转必须经真实 Console API 完成。
BEGIN;
WITH inserted AS (
  INSERT INTO batch.result_version (
    tenant_id, business_key, version_no, job_instance_id, status,
    effective_at, payload_storage, payload_json, generated_at,
    generated_by, promotion_policy, dq_gate_status
  )
  VALUES
    (:'tenant_id', :'effective_business_key', 1, 9000000000000001, 'EFFECTIVE',
     current_timestamp - interval '1 hour', 'INLINE_JSON',
     jsonb_build_object('privateMarker', :'payload_marker', 'businessData', 'fixture-secret'),
     current_timestamp - interval '1 hour', 'result-version-fixture', 'MANUAL_APPROVAL', 'PASS'),
    (:'tenant_id', :'effective_business_key', 2, 9000000000000002, 'PENDING',
     null, 'INLINE_JSON',
     jsonb_build_object('privateMarker', :'payload_marker', 'businessData', 'fixture-secret'),
     current_timestamp, 'result-version-fixture', 'MANUAL_APPROVAL', 'PASS'),
    (:'tenant_id', :'archived_business_key', 1, 9000000000000003, 'PENDING',
     null, 'INLINE_JSON',
     jsonb_build_object('privateMarker', :'payload_marker', 'businessData', 'fixture-secret'),
     current_timestamp, 'result-version-fixture', 'MANUAL_APPROVAL', 'PASS'),
    (:'tenant_id', :'admin_archived_business_key', 1, 9000000000000004, 'PENDING',
     null, 'INLINE_JSON',
     jsonb_build_object('privateMarker', :'payload_marker', 'businessData', 'fixture-secret'),
     current_timestamp, 'result-version-fixture', 'MANUAL_APPROVAL', 'PASS')
  RETURNING id, business_key, version_no
)
SELECT json_build_object(
  'versionIds', json_agg(id ORDER BY business_key, version_no),
  'versionCount', count(*)
) FROM inserted;
COMMIT;

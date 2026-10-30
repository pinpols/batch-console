WITH deleted AS (
  DELETE FROM batch.forensic_export_log
  WHERE tenant_id = :'tenant_id'
  RETURNING export_id, storage_path
)
SELECT coalesce(
  json_agg(json_build_object('exportId', export_id, 'storagePath', storage_path)),
  '[]'::json
)::text
FROM deleted;

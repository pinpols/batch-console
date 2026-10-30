SELECT coalesce(
  json_agg(json_build_object(
    'tenantId', tenant_id,
    'exportId', export_id,
    'bizDateFrom', biz_date_from,
    'bizDateTo', biz_date_to,
    'exportFormat', export_format,
    'status', status,
    'storagePath', storage_path,
    'fileSizeBytes', file_size_bytes,
    'sha256', sha256,
    'rowCounts', row_counts,
    'requestedBy', requested_by
  ) ORDER BY requested_at, id),
  '[]'::json
)::text
FROM batch.forensic_export_log
WHERE tenant_id = :'tenant_id';

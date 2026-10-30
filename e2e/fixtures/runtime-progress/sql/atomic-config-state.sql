SELECT COALESCE(
    json_agg(
        json_build_object(
            'tenantId', tenant_id,
            'taskType', task_type,
            'name', name,
            'parameters', parameters::text,
            'createdBy', created_by
        ) ORDER BY name
    ),
    '[]'::json
)::text
FROM batch.atomic_task_config
WHERE tenant_id = :'tenant_id'
  AND task_type = 'sql'
  AND name = ANY(string_to_array(:'config_names', ','));

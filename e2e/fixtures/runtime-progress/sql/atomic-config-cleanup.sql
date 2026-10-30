WITH deleted AS (
    DELETE FROM batch.atomic_task_config
    WHERE tenant_id = :'tenant_id'
      AND task_type = 'sql'
      AND name = ANY(string_to_array(:'config_names', ','))
    RETURNING id
)
SELECT count(*) AS deleted FROM deleted
\gset
SELECT json_build_object(
    'deleted', :deleted::bigint,
    'remaining', (
        SELECT count(*)
        FROM batch.atomic_task_config
        WHERE tenant_id = :'tenant_id'
          AND task_type = 'sql'
          AND name = ANY(string_to_array(:'config_names', ','))
    )
)::text;

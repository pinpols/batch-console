SELECT COALESCE(
    jsonb_agg(
        jsonb_build_object(
            'workflowDefinitionId', workflow_definition_id,
            'version', version,
            'nodes', nodes_json,
            'edges', edges_json
        ) ORDER BY version
    ),
    '[]'::jsonb
)::text
FROM batch.workflow_definition_version
WHERE tenant_id = :'tenant_id';

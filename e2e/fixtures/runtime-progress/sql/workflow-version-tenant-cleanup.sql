DELETE FROM batch.tenant
WHERE tenant_id = :'other_tenant_id';

SELECT jsonb_build_object(
    'tenantRowsRemaining',
    (SELECT count(*)::integer FROM batch.tenant WHERE tenant_id = :'other_tenant_id')
)::text;

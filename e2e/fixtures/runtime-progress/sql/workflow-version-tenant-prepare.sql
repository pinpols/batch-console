INSERT INTO batch.tenant (tenant_id, tenant_name, status)
VALUES (:'other_tenant_id', :'other_tenant_id', 'ACTIVE');

SELECT jsonb_build_object('tenantId', tenant_id)::text
FROM batch.tenant
WHERE tenant_id = :'other_tenant_id';

WITH identity_deleted AS (
  DELETE FROM batch.console_external_identity
  WHERE tenant_id = :'tenant_id' AND subject = :'oidc_subject'
  RETURNING 1
), audit_deleted AS (
  DELETE FROM batch.console_operation_audit
  WHERE tenant_id = :'tenant_id'
    AND aggregate_type = 'oidc_identity'
    AND action IN ('auth.oidc.identity.bind', 'auth.oidc.identity.unbind')
  RETURNING 1
)
SELECT json_build_object(
  'identityDeleted', (SELECT count(*) FROM identity_deleted),
  'auditDeleted', (SELECT count(*) FROM audit_deleted)
)::text;

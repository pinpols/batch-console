WITH identity_row AS (
  SELECT i.id, a.username, i.issuer, i.subject, i.linked_by
  FROM batch.console_external_identity i
  JOIN batch.console_user_account a
    ON a.tenant_id = i.tenant_id AND a.id = i.account_id
  WHERE i.tenant_id = :'tenant_id' AND i.subject = :'oidc_subject'
), audit_rows AS (
  SELECT id, action, result
  FROM batch.console_operation_audit
  WHERE tenant_id = :'tenant_id'
    AND aggregate_type = 'oidc_identity'
    AND action IN ('auth.oidc.identity.bind', 'auth.oidc.identity.unbind')
), account_row AS (
  SELECT authorities_csv
  FROM batch.console_user_account
  WHERE tenant_id = :'tenant_id' AND username = :'reader_name'
)
SELECT json_build_object(
  'identityCount', (SELECT count(*) FROM identity_row),
  'identity', (SELECT json_build_object(
    'id', id,
    'username', username,
    'issuer', issuer,
    'subject', subject,
    'linkedBy', linked_by
  ) FROM identity_row LIMIT 1),
  'auditActions', (SELECT coalesce(
    json_agg(json_build_object('action', action, 'result', result) ORDER BY action, id),
    '[]'::json
  ) FROM audit_rows),
  'accountRoles', (SELECT authorities_csv FROM account_row)
)::text;

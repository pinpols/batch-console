BEGIN;
INSERT INTO batch.console_user_account
  (tenant_id, username, display_name, password_hash, authorities_csv, enabled, must_change_password)
SELECT :'tenant_id', role_account.username, role_account.username,
       admin.password_hash, role_account.authority, true, false
  FROM batch.console_user_account admin
 CROSS JOIN (VALUES (:'auditor_name', 'ROLE_AUDITOR'), (:'user_name', 'ROLE_TENANT_USER'))
       AS role_account(username, authority)
 WHERE admin.tenant_id = 'system'
   AND admin.username = :'admin_name';
SELECT json_build_object(
  'roleAccountsCreated', count(*)
)
  FROM batch.console_user_account
 WHERE tenant_id = :'tenant_id'
   AND username IN (:'auditor_name', :'user_name');
COMMIT;

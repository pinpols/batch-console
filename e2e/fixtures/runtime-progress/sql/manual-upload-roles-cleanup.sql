DELETE FROM batch.console_user_account
 WHERE tenant_id = :'tenant_id'
   AND username IN (:'auditor_name', :'user_name');
SELECT json_build_object(
  'roleAccountsRemaining', count(*)
)
  FROM batch.console_user_account
 WHERE tenant_id = :'tenant_id'
   AND username IN (:'auditor_name', :'user_name');

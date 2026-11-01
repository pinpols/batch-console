-- 只读核对本例随机角色用户名及独占租户。
SELECT count(*)
  FROM batch.console_user_account
 WHERE tenant_id = :'tenant_id'
   AND username IN (:'auditor_name', :'user_name');

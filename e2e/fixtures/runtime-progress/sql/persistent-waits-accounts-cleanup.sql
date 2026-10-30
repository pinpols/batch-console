-- 按随机用户名与本例租户双重限定删除额外角色账户。
DELETE FROM batch.console_user_account
 WHERE tenant_id = :'tenant_id'
   AND username IN (:'auditor_name', :'user_name');
SELECT count(*) FROM batch.console_user_account
 WHERE tenant_id = :'tenant_id'
   AND username IN (:'auditor_name', :'user_name');

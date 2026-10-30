-- 数字身份与随机用户名同时命中才删除；失败准备不会扩大清理范围。
DELETE FROM batch.console_user_account
WHERE id=ANY(string_to_array(:'account_ids',',')::bigint[])
  AND username IN (:'admin_name',:'reader_name');
SELECT count(*) FROM batch.console_user_account
WHERE id=ANY(string_to_array(:'account_ids',',')::bigint[])
   OR username IN (:'admin_name',:'reader_name');

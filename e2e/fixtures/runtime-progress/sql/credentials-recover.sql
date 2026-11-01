-- 未收到提交结果时，只恢复本例随机用户名、租户和密码哈希匹配的数字身份。
SELECT json_build_object(
    'ids', coalesce(json_agg(id) FILTER (WHERE password_hash = :'password_hash'), '[]'::json),
    'mismatches', count(*) FILTER (WHERE password_hash <> :'password_hash')
)
  FROM batch.console_user_account
 WHERE (tenant_id = 'system' AND username = :'admin_name')
    OR (tenant_id = :'tenant_id' AND username = :'reader_name');

-- 仅创建本例随机身份，不读取或覆盖共享管理员。密码由被验收JAR的正式实现生成。
BEGIN;
WITH inserted AS (
  INSERT INTO batch.console_user_account
    (tenant_id,username,display_name,password_hash,authorities_csv,enabled,must_change_password)
  VALUES
    ('system',:'admin_name',:'admin_name',:'password_hash','ROLE_ADMIN',true,false),
    (:'tenant_id',:'reader_name',:'reader_name',:'password_hash','ROLE_TENANT_ADMIN',true,false)
  RETURNING id
)
SELECT json_agg(id) FROM inserted;
COMMIT;

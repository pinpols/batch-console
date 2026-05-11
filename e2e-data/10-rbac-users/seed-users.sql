-- seed-users.sql
-- 在 console_user_account 表造 5 个 RBAC 测试用户。
-- 真实表名:batch.console_user_account
-- 字段:tenant_id / username / display_name / password_hash / authorities_csv / enabled
--
-- 注意:**BE / FE 都没有暴露 POST /api/console/users 接口**(只有 GET/PUT),所以测试用户
-- 必须直接 SQL 插入,或通过 tenant batch-create 间接创建首位管理员。
-- 密码 hash 用 Argon2id(BE 默认 encoder)。下面的 hash 是占位,需要 BE 同事用 BE 工具或
--   `mvn exec:java -Dexec.mainClass=...PasswordHasher` 替换为真实 hash;或者改用 BCrypt 兼容
--
-- authorities_csv 枚举(对应 FE ROLE_*):
--   ROLE_ADMIN / ROLE_OPERATOR / ROLE_VIEWER / ROLE_TENANT_USER / ROLE_AUDITOR / ROLE_CONFIG_ADMIN
--
-- 用法:  psql -h localhost -p 15432 -U batch -d batch_console -f seed-users.sql
-- 清理:  DELETE FROM batch.console_user_account WHERE username LIKE 'test-%';

BEGIN;

-- 占位 hash 示例(对应密码 Test@2026e2e1,Argon2id) — BE 同事须用真 hash 替换!
-- 临时方案:用 BCrypt-encoded "Test@2026e2e1" → $2a$10$rN... (从 BE PasswordEncoder 工具生成)
--
-- 推荐流程:
--   1) BE 同事登录 console-api Maven 项目,跑 PasswordHasherCli 生成 hash
--   2) 把下面 6 个 :HASH_FOR_TestOp_2026taX 等 placeholder 替换
--   3) 执行 SQL

INSERT INTO batch.console_user_account (
  tenant_id, username, display_name, password_hash, authorities_csv, enabled
) VALUES
  ('ta',     'test-op-ta',     'OP for ta',
   '$argon2id$v=19$m=65536,t=3,p=4$REPLACE_WITH_REAL_HASH_FOR_TestOp_2026taX',
   'ROLE_OPERATOR', TRUE),

  ('ta',     'test-viewer-ta', 'Viewer for ta',
   '$argon2id$v=19$m=65536,t=3,p=4$REPLACE_WITH_REAL_HASH_FOR_TestVi_2026taX',
   'ROLE_VIEWER', TRUE),

  ('ta',     'test-tu-ta',     'TenantUser for ta',
   '$argon2id$v=19$m=65536,t=3,p=4$REPLACE_WITH_REAL_HASH_FOR_TestTu_2026taX',
   'ROLE_TENANT_USER', TRUE),

  ('system', 'test-auditor',   'Auditor',
   '$argon2id$v=19$m=65536,t=3,p=4$REPLACE_WITH_REAL_HASH_FOR_TestAu_2026sysX',
   'ROLE_AUDITOR', TRUE),

  ('system', 'test-cfg-admin', 'Config Admin',
   '$argon2id$v=19$m=65536,t=3,p=4$REPLACE_WITH_REAL_HASH_FOR_TestCf_2026sysX',
   'ROLE_CONFIG_ADMIN', TRUE);

COMMIT;

-- 验证:
-- SELECT tenant_id, username, authorities_csv, enabled FROM batch.console_user_account
--   WHERE username LIKE 'test-%' ORDER BY tenant_id, username;

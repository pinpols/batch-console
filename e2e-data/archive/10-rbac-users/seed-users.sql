-- seed-users.sql
-- 在 console_user_account 表造 3 个非 admin RBAC 测试用户。
-- 真实表名:batch.console_user_account
-- 字段:tenant_id / username / display_name / password_hash / authorities_csv / enabled
--
-- 优先使用 POST /api/console/users 创建测试账号；本 SQL 仅用于需要直接准备数据库的本地验收。
-- 密码 hash 用 Argon2id(BE 默认 encoder)。下面的 hash 是占位,需要 BE 同事用 BE 工具或
--   `mvn exec:java -Dexec.mainClass=...PasswordHasher` 替换为真实 hash;或者改用 BCrypt 兼容
--
-- authorities_csv 只允许四类正式角色:
--   ROLE_ADMIN / ROLE_AUDITOR / ROLE_TENANT_ADMIN / ROLE_TENANT_USER
--
-- 用法:  psql -h localhost -p 15432 -U batch -d batch_console -f seed-users.sql
-- 清理:  DELETE FROM batch.console_user_account WHERE username LIKE 'test-%';

BEGIN;

-- 占位 hash 示例(对应密码 Test@2026e2e1,Argon2id) — BE 同事须用真 hash 替换!
-- 临时方案:用 BCrypt-encoded "Test@2026e2e1" → $2a$10$rN... (从 BE PasswordEncoder 工具生成)
--
-- 推荐流程:
--   1) BE 同事登录 console-api Maven 项目,跑 PasswordHasherCli 生成 hash
--   2) 把下面 3 个 hash placeholder 替换
--   3) 执行 SQL

INSERT INTO batch.console_user_account (
  tenant_id, username, display_name, password_hash, authorities_csv, enabled
) VALUES
  ('ta',     'test-tadmin-ta', 'Tenant admin for ta',
   '$argon2id$v=19$m=65536,t=3,p=4$REPLACE_WITH_REAL_HASH_FOR_TestTa_2026taX',
   'ROLE_TENANT_ADMIN', TRUE),

  ('ta',     'test-tu-ta',     'Tenant user for ta',
   '$argon2id$v=19$m=65536,t=3,p=4$REPLACE_WITH_REAL_HASH_FOR_TestTu_2026taX',
   'ROLE_TENANT_USER', TRUE),

  ('system', 'test-auditor',   'Platform auditor',
   '$argon2id$v=19$m=65536,t=3,p=4$REPLACE_WITH_REAL_HASH_FOR_TestAu_2026sysX',
   'ROLE_AUDITOR', TRUE);

COMMIT;

-- 验证:
-- SELECT tenant_id, username, authorities_csv, enabled FROM batch.console_user_account
--   WHERE username LIKE 'test-%' ORDER BY tenant_id, username;

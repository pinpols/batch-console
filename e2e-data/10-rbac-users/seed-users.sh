#!/usr/bin/env bash
# seed-users.sh — 提示器:测试用户必须用 SQL 创建。
#
# 🚨 BE / FE 都没暴露 POST /api/console/users(已核验 src/types/api.generated.ts
# 与 src/api/userAccounts.ts,只有 GET/PUT/enable/disable/reset-password)。
# 创建测试用户的唯一途径是直接往 batch.console_user_account 表插入。

cat <<'EOF'
═══════════════════════════════════════════════════════════════════
  10-rbac-users:无法通过 FE/BE API 创建测试用户
═══════════════════════════════════════════════════════════════════

  原因:BE openapi 与 FE userAccounts.ts 均未暴露 POST /api/console/users。
        测试用户必须由 BE 同事用 SQL 直接插入。

  推荐步骤:
    1. BE 同事用 file-batch-system 项目内 PasswordEncoder 生成 5 个 Argon2id 密码 hash:
         (示例 — 实际命令以 BE 工具为准)
         mvn -pl batch-console-api exec:java \
             -Dexec.mainClass=com.acme.batch.console.PasswordHasherCli \
             -Dexec.args='TestOp@2026taX TestVi@2026taX TestTu@2026taX TestAu@2026sysX TestCf@2026sysX'

    2. 把 hash 替换到 seed-users.sql 里 5 处 REPLACE_WITH_REAL_HASH_* 占位

    3. 执行:
         psql -h localhost -p 15432 -U batch -d batch_console \
              -f e2e-data/10-rbac-users/seed-users.sql

    4. 验证:
         psql -c "SELECT username, authorities_csv FROM batch.console_user_account
                  WHERE username LIKE 'test-%';"

  清理:
    psql -c "DELETE FROM batch.console_user_account WHERE username LIKE 'test-%';"

═══════════════════════════════════════════════════════════════════
EOF

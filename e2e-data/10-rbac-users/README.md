# 账号与角色历史输入

本页是保留输入与当前测试入口的目录说明。执行范围与准备/清理规则见[本目录总览](../README.md)和[执行说明](../EXEC-MATRIX.md)。

## 保留资产

- [`users.json`](./users.json)：历史用户样本，其中旧角色和口令只用于追溯当时测试输入。
- [历史用户 SQL](../archive/10-rbac-users/seed-users.sql)与[提示脚本](../archive/10-rbac-users/seed-users.sh)。

## 当前入口与适用性

当前仅使用 `ROLE_ADMIN`、`ROLE_AUDITOR`、`ROLE_TENANT_ADMIN`、`ROLE_TENANT_USER`，权限依据见[角色与页面矩阵](../../docs/user-guide/role-page-matrix.md)。账户可通过当前 [`src/api/userAccounts.ts`](../../src/api/userAccounts.ts)的创建和批量流程管理；不能沿用归档脚本“没有创建 API，只能 SQL”的结论。

测试账号由当前 setup/专属 helper 配置，场景见 [`rbac-matrix.spec.ts`](../../e2e/rbac-matrix.spec.ts)、[`rbac-denial.spec.ts`](../../e2e/rbac-denial.spec.ts)。历史 JSON、旧角色及密码哈希占位不作为当前账号准备指令。

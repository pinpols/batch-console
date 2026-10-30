# Outbox 场景资料

本页是保留输入与当前测试入口的目录说明。执行范围与准备/清理规则见[本目录总览](../README.md)和[执行说明](../EXEC-MATRIX.md)。

## 保留资产

- [历史 Outbox 造数 SQL](../archive/07-outbox-stuck/seed-outbox-stuck.sql)。

## 当前入口与适用性

现行场景见 [`alert-outbox-ops.spec.ts`](../../e2e/alert-outbox-ops.spec.ts)、[`flows/08-outbox-stuck-republish.spec.ts`](../../e2e/flows/08-outbox-stuck-republish.spec.ts)。状态、重试、重发布和清理的契约以后端与 [`src/api/ops.ts`](../../src/api/ops.ts)为准。

目录名称沿用历史场景名；它不声明后端具有 `STUCK` 状态。直接插入 Outbox/重试表的旧 SQL 已归档，不能作为当前可重复、无副作用的准备步骤。

# 审批场景资料

本页是保留输入与当前测试入口的目录说明。执行范围与准备/清理规则见[本目录总览](../README.md)和[执行说明](../EXEC-MATRIX.md)。

## 保留资产

- [历史待审批 SQL](../archive/04-approvals-pending/seed-pending-approvals.sql)：当时的通用业务审批造数样本。

## 当前入口与适用性

当前审批目标由 [`e2e/support/test-data.ts`](../../e2e/support/test-data.ts)中的 helper 和具体用例建立，见 [`approval-actions.spec.ts`](../../e2e/approval-actions.spec.ts)、[`approval-ops.spec.ts`](../../e2e/approval-ops.spec.ts)。通用审批与配置发布审批的标识、状态和动作不同，消费方见 [`src/api/approvals.ts`](../../src/api/approvals.ts)、[`src/api/configReleases.ts`](../../src/api/configReleases.ts)。

历史 SQL 不保证创建当前配置发布审批，也不证明审批动作已实际执行或产生业务副作用。

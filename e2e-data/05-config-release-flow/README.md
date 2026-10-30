# 配置发布输入

本页是保留输入与当前测试入口的目录说明。执行范围与准备/清理规则见[本目录总览](../README.md)和[执行说明](../EXEC-MATRIX.md)。

## 保留资产

- [`payloads/release-create.json`](./payloads/release-create.json)
- [`payloads/release-submit-approval.json`](./payloads/release-submit-approval.json)
- [`payloads/release-gray.json`](./payloads/release-gray.json)
- [`payloads/release-publish.json`](./payloads/release-publish.json)
- [`payloads/release-rollback.json`](./payloads/release-rollback.json)

## 当前入口与适用性

以上为历史请求样本。现行字段、版本条件与操作入口见 [`src/api/configReleases.ts`](../../src/api/configReleases.ts)和后端 OpenAPI；用例见 [`config-release-ops.spec.ts`](../../e2e/config-release-ops.spec.ts)、[`config-release-advanced.spec.ts`](../../e2e/config-release-advanced.spec.ts)。

发布状态、审批和回滚依赖真实目标及版本。样本文件名不表示当前接口一定提供同名操作，也不能证明从创建到发布的整条链路已通过。

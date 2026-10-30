# 系统配置请求样本

本页是保留输入与当前测试入口的目录说明。执行范围与准备/清理规则见[本目录总览](../README.md)和[执行说明](../EXEC-MATRIX.md)。

## 保留资产

- API Key：[`api-key-create.json`](./payloads/api-key-create.json)。
- Webhook：[`webhook-create.json`](./payloads/webhook-create.json)。
- 通知：[`notification-channel-email.json`](./payloads/notification-channel-email.json)、[`notification-channel-feishu.json`](./payloads/notification-channel-feishu.json)、[`notification-rule-job-failed.json`](./payloads/notification-rule-job-failed.json)。
- 标签、账户、参数与归档：[`tag-batch-create.json`](./payloads/tag-batch-create.json)、[`user-create.json`](./payloads/user-create.json)、[`system-parameter-update.json`](./payloads/system-parameter-update.json)、[`archive-policy-update.json`](./payloads/archive-policy-update.json)。

## 当前入口与适用性

以上是历史输入，不固化当前账户、权限、字段或资源作用域。现行消费方见 [`src/api/`](../../src/api/)对应领域模块；场景见 [`api-key-crud.spec.ts`](../../e2e/api-key-crud.spec.ts)、[`webhook-crud.spec.ts`](../../e2e/webhook-crud.spec.ts)、[`notification-crud.spec.ts`](../../e2e/notification-crud.spec.ts)、[`user-account-ops.spec.ts`](../../e2e/user-account-ops.spec.ts)。

账户创建已在 [`src/api/userAccounts.ts`](../../src/api/userAccounts.ts)提供；历史 `user-create.json` 的不支持标记和数据库字段不能当作现行 API 请求体。Secret、密钥和通知目标在测试环境按当前契约配置，说明文档不保存运行凭据。

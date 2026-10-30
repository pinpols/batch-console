# 自助服务请求样本

本页是保留输入与当前测试入口的目录说明。执行范围与准备/清理规则见[本目录总览](../README.md)和[执行说明](../EXEC-MATRIX.md)。

## 保留资产

- [`payloads/rerun-request.json`](./payloads/rerun-request.json)
- [`payloads/compensation-request.json`](./payloads/compensation-request.json)
- [`payloads/quota-request.json`](./payloads/quota-request.json)

## 当前入口与适用性

现行消费方见 [`src/api/selfServiceJobs.ts`](../../src/api/selfServiceJobs.ts)、[`src/api/tenantSelfService.ts`](../../src/api/tenantSelfService.ts)；场景见 [`self-service.spec.ts`](../../e2e/self-service.spec.ts)与 [`self-service-forms.spec.ts`](../../e2e/self-service-forms.spec.ts)。

请求目标、权限、是否需要审批以及成功后的业务状态，以当前后端契约和具体测试断言为准；不从样本中的固定作业或实例推断环境已准备。

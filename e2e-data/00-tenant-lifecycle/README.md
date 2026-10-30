# 租户生命周期输入

本页是保留输入与当前测试入口的目录说明。执行范围与准备/清理规则见[本目录总览](../README.md)和[执行说明](../EXEC-MATRIX.md)。

## 保留资产

- [`payloads/single-create.json`](./payloads/single-create.json)：单个租户创建样本。
- [`payloads/batch-create.json`](./payloads/batch-create.json)：批量创建样本。
- [`payloads/batch-init.json`](./payloads/batch-init.json)：历史批量初始化样本。
- [`payloads/tenant-copy.json`](./payloads/tenant-copy.json)：租户复制样本。
- [`payloads/quota-request.json`](./payloads/quota-request.json)：配额申请样本。

## 当前入口与适用性

当前 API 消费方见 [`src/api/tenants.ts`](../../src/api/tenants.ts)和相关租户配置调用；场景见 [`tenant-ops.spec.ts`](../../e2e/tenant-ops.spec.ts)、[`tenant-config-ops.spec.ts`](../../e2e/tenant-config-ops.spec.ts)。租户创建、初始化和复制是不同操作，按目标接口的当前 DTO、权限和准备状态核对，不能从目录顺序推断它们已完成。

历史一键造租户脚本已迁到 [`archive/00-tenant-lifecycle/`](../archive/00-tenant-lifecycle/)，旧 token 登录和默认账号假设不再作为当前流程。

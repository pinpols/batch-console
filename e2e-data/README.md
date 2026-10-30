# 前端测试输入与历史联调资料

本目录保留场景输入（XLSX、JSON、CSV）和历史联调资产。输入文件的存在不证明它符合当前后端 Schema，也不证明对应业务已经验收；使用前以配对后端 OpenAPI、模板 Schema 和当前测试用例为准。

## 当前执行入口

- 测试分层、环境和证据要求见[测试指南](../docs/testing/README.md)与[CI 手册](../docs/runbook/ci.md)。真实后端验收由 [`scripts/local/fe-acceptance.sh`](../scripts/local/fe-acceptance.sh)组织。
- 登录和基础夹具由 [`e2e/global-setup.cjs`](../e2e/global-setup.cjs)、[`e2e/support/`](../e2e/support/)及当前 spec 管理；会话使用后端 Cookie，写入同时遵循 CSRF 契约。账号与地址从运行环境配置读取。
- 清理由 [`e2e/global-teardown.cjs`](../e2e/global-teardown.cjs)按本轮前缀处理。它可能跳过或失败；完成一轮测试后仍需核对实际清理输出。
- [`verify-data.sh`](./verify-data.sh)检查保留输入的结构完整性，不调用后端，不是接口、数据库或业务验收。

## 场景目录

| 场景 | 保留的输入 | 说明 |
|---|---|---|
| [00 租户生命周期](./00-tenant-lifecycle/README.md) | 创建、批量创建、初始化、复制和配额 JSON | 样本按当前 DTO 重核后使用 |
| [01 配置包导入](./01-tenant-config-import/README.md) | 三份租户配置 XLSX | 后端模板为权威来源 |
| [02 Excel 边界](./02-excel-edge-cases/README.md) | 缺列、非法枚举和大文件 XLSX | 历史异常输入，不固化当前行数限制 |
| [03 实例状态](./03-job-instance-states/README.md) | 历史造数说明 | SQL 与触发脚本已归档 |
| [04 待审批](./04-approvals-pending/README.md) | 历史造数说明 | 当前用例通过测试 helper 建立审批 |
| [05 配置发布](./05-config-release-flow/README.md) | 发布操作 JSON | 不将历史样本当作完整发布流程 |
| [06 文件流](./06-file-pipeline/README.md) | CSV 与文件操作 JSON | 保留空文件和无效编码输入 |
| [07 Outbox](./07-outbox-stuck/README.md) | 历史造数说明 | SQL 已归档；状态以后端为准 |
| [08 系统配置](./08-system-level/README.md) | 系统级 CRUD JSON | 权限、字段与 Secret 处理按当前契约 |
| [09 自助服务](./09-self-service/README.md) | 重跑、补偿和配额 JSON | 不从样本推断可执行目标与权限 |
| [10 账号与 RBAC](./10-rbac-users/README.md) | 历史用户 JSON | 四角色模型与当前 API 为准 |

## 历史资料

旧 Bearer 登录、直接 SQL 造数、环境修复和清理脚本统一进入 [`archive/`](./archive/README.md)，仅保留原始证据，不能直接作为当前执行入口。旧脚本的相对输入依赖也不承诺可运行。

两份一次性报告已归档：[2026-05-11 交付计划](../docs/archive/qa-2026-05/e2e-data-test-plan-2026-05-11.md)、[2026-05-11 数据核验](../docs/archive/qa-2026-05/e2e-data-verification-2026-05-11.md)。当前执行依赖、互斥和清理边界见[执行说明](./EXEC-MATRIX.md)。

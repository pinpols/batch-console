# 测试输入依赖、环境互斥与清理边界

本文维护当前执行约束。具体测试项目与配置以 [`playwright.config.cjs`](../playwright.config.cjs)、[CI 手册](../docs/runbook/ci.md)及当前 spec 为准；本目录的历史 SQL 和脚本不参与自动初始化。

## 准备与执行

1. 按[测试指南](../docs/testing/README.md)选择 mock、真实后端或发布验收范围，确认目标地址、账号、租户与所需服务。
2. 由 [`e2e/global-setup.cjs`](../e2e/global-setup.cjs)准备会话及基础夹具。配置包来源优先使用配对后端现行模板；本目录 XLSX 是保留输入，必须先核对 Schema。
3. 用例专属目标由对应 spec 和 [`e2e/support/test-data.ts`](../e2e/support/test-data.ts)等 helper 建立。审批、发布和实例操作各自有目标状态要求，不能用历史“已 seed”文字替代准备证据。
4. 真实后端全链路验收使用 [`scripts/local/fe-acceptance.sh`](../scripts/local/fe-acceptance.sh)。命令成功只代表该次实际运行范围，未运行、SKIP 和业务持久化证明分别记录。

## 互斥关系

| 共享状态 | 冲突 | 处理依据 |
|---|---|---|
| 同租户配置、发布版本、作业启停 | 发布、导入、复制会改变后续触发和查询条件 | 按当前 spec 的串行项目、独立租户或本轮唯一资源隔离 |
| 同账号会话与账户状态 | 改密、重置、禁用可能使其他会话失效 | 使用专项账号；依照测试配置协调执行 |
| 实例、审批与 Outbox | 同目标的取消、审批、重发布会改变后续前置 | 用例自己创建目标并读取操作结果；不能仅凭目录不同断言可并行 |
| 测试前缀与 teardown | 一个执行批次的清理可能影响使用相同前缀的其他批次 | 为批次选择清晰的资源边界，并核对全局 teardown 输出 |

不同租户通常提供隔离边界，但系统级账号、限流、发布和共享基础设施仍可能产生竞争；并行策略以当前测试配置和实际环境为准。

## 清理的实际能力

当前全局清理入口是 [`e2e/global-teardown.cjs`](../e2e/global-teardown.cjs)。它复用 setup 的 Cookie，并按 `BC_E2E_PREFIX` 调用后端测试数据清理端点。`BC_E2E_SKIP_TEARDOWN=1`、缺少会话、后端不可达或错误响应都可能使清理未完成；其日志不能省略。

旧 `cleanup-soft.sh`、`cleanup-config.sh`、`cleanup-hard.sh` 和 `cleanup-tx.sh` 已进入[历史脚本目录](./archive/README.md)。它们原有实现不提供完整的实例、审批、发布、Tag、通知和账户回滚保证，也不应作为当前环境清理方案。保留资料中的 SQL 同样需要在目标后端 Schema 与专属数据范围确认后重新设计。

## 输入检查与证据

`verify-data.sh`只检查输入结构和归档资产存在性。验收报告应记录代码基线、环境、实际用例范围、准备/清理输出及未验证项。目录内文件数量、历史报告通过率和页面正常加载均不能替代当前业务闭环证据。

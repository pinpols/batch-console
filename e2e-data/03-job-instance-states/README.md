# 实例状态场景资料

本页是保留输入与当前测试入口的目录说明。执行范围与准备/清理规则见[本目录总览](../README.md)和[执行说明](../EXEC-MATRIX.md)。

## 保留资产

- [历史实例 SQL](../archive/03-job-instance-states/seed-job-instances.sql)。
- [历史触发与等待脚本](../archive/03-job-instance-states/trigger-and-wait.sh)。

## 当前入口与适用性

当前场景见 [`monitor-ops.spec.ts`](../../e2e/monitor-ops.spec.ts)、[`job-ops.spec.ts`](../../e2e/job-ops.spec.ts)和共享测试 helper。操作目标必须具有当前接口要求的租户、实例标识与状态；状态和调度语义以后端实现及生成类型为准。

本目录不再提供直接写数据库或固定等待后视为执行成功的当前步骤。历史 SQL 的字段、约束、作业引用和状态需要在目标后端重新核对。

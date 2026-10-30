# 持久等待真实联调

## 范围

验证 readiness 等待与 Workflow 容量等待从真实 PostgreSQL 持久化记录，经 Orchestrator Mapper、Console BFF，最终展示在现有“调度快照”页的持久等待页签。页面复用已有调度观测入口，没有新增重复看板；该页面是等待明细，不承载租户日统计图表。

## 结果

- WDI 真实认证环境下 Chromium E2E 通过，1/1、0 重试。
- 独占夹具写入 1 条 `READINESS/PENDING` 和 1 条 `CAPACITY_ADMISSION/WAITING`，真实 Console 分页读回两条；类型、状态过滤以及 pageSize=1 的两页结果均符合预期。
- 页面在 ADMIN、TENANT_ADMIN 和 AUDITOR 会话中显示两类等待；TENANT_USER 页面不显示等待面板。
- API 权限结果：ADMIN 200；TENANT_ADMIN 本租户 200、跨租户 403；AUDITOR 本租户和跨租户 200；TENANT_USER 403；匿名 401。
- 容量等待数据库记录内保留测试用私有载荷标记，但 Console 响应与页面均不包含该标记，投影字段中也没有 payload 字段。
- 两类等待表的 ID 是各自表内编号，可能数值相同。前端表格行键已改为 `waitType:id`，避免跨表记录发生行身份冲突。
- E2E finally 与独立状态读回确认 readiness/capacity 等待行、Workflow 定义及关联记录、临时租户和角色账号的残留计数均为 0。

## 证据与边界

脱敏权限和载荷断言见[真实证据 JSON](./assets/persistent-waits-2026-10-26/real-evidence.json)。真实浏览器用例为 `e2e/persistent-waits-real.spec.ts`，独占数据库夹具及环境要求见 [`runtime-progress` 夹具说明](../../e2e/fixtures/runtime-progress/README.md)。

本报告证明本地 WDI PostgreSQL、Orchestrator、Console 和浏览器之间的这条查询链路及角色边界；不代表生产环境发布验收，也不覆盖等待记录的创建/解除调度行为。持久等待查询保持只读。

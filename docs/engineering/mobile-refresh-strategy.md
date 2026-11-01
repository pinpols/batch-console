# 移动端数据刷新策略

**状态**: Accepted
**日期**: 2026-05-16
**适用范围**: `src/views-mobile/*` 所有移动 PWA 页面

---

## 1. 按数据性质选择刷新方式

移动 Workflow 运行进度复用 `useWorkflowExecutionProgress`，首页租户每日进度复用 `useDailyProgress`：以完整快照推送为主，首屏、重连和 reset 读取快照，断线按共享策略回退。首页下拉刷新同时刷新概览和每日快照；30 秒轮询只用于概览。列表和未接入进度快照的详情继续按页面选择轮询或手动刷新；AI 对话使用独立的 POST SSE。不同链路的刷新状态各自展示，不能凭固定间隔推断任务完成度。

## 2. 统一的轮询档位

参见 [`src/layout-mobile/composables/refreshIntervals.ts`](../../src/layout-mobile/composables/refreshIntervals.ts)。

| 档 | 时长 | 何时用 | 例子 |
|---|---|---|---|
| **HOT** | 10s | 未接入推送的运行中详情 | `MJobInstanceDetail`(运行态时短轮询) |
| **WARM** | 20s | 次实时列表 — 告警未读、待审批堆积 | `MAlerts` |
| **COLD** | 30s | 一般概览 — 拓扑/计数类 | `MOpsSummary`、`MWorkers`、`MOutbox` |

**没列出的页面**(`MApprovals`、`MCatchUp`、`MJobInstances` 列表、`MExecutionLog`、`MFileList`)
**故意不自动轮询**,理由:

- 用户在列表页主动找的目标,刷新当下数据没意义
- 下拉刷新(`MPullRefresh`)已经覆盖手动 case
- 进入对应详情页后,详情页会有 HOT 短轮询

## 3. 共享 composable 约定

- **`useTenantReload(fn)`** 是唯一首屏 + 切租户重取入口(`immediate: true` 的 watch),不要再
  手写 `onMounted(fn) + watch(() => tenant.tenantId, fn)`。漏写后者会造成"切租户后数据不刷新"
  bug(典型如旧 `OpsSummary`)
- **`useAutoRefresh(fn, intervalMs)`** 已内置 visibilitychange 暂停 + 最小间隔保护,直接用
- **`MPullRefresh`** 包页面外层,提供下拉刷新;**所有列表页 + 详情页**都该加
- 详情页活跃运行态的短轮询,**必须用 computed 守门**(终态时不轮询):
  ```ts
  const isRunning = computed(() => !TERMINAL.has(row.value?.instanceStatus))
  useAutoRefresh(() => { if (isRunning.value) void load() }, REFRESH_INTERVAL_HOT_MS)
  ```

## 4. Workflow 运行进度

`/m/workflow/run/:id` 的 `id` 是 Workflow 运行 ID；页面复用桌面运行进度组件和 `useWorkflowExecutionProgress`，以该运行冻结快照的节点、边和状态呈现 DAG。快照不可用时明确提示，不用当前定义图补画历史运行；切租户或运行 ID 时由共享 composable 清理旧作用域。下拉刷新复用同一面板，不再单独建立轮询。

`/m/workflow/:id` 的 `id` 是 Workflow 定义 ID，只展示定义图。旧链接 `/m/workflow/:定义ID?runId=运行ID` 会跳转运行页；两类 ID 不互换，Workflow 运行 ID 也不作为 Job 实例 ID 跳转。

## 5. 深链 + 登录流转

PWA push / 邮件 / 扫码 进入未登录态时:

1. `/m/jobs/123` → router guard 未登录 → `/login?redirect=/m/jobs/123`
2. `Login.vue` 自带 `@media (max-width: 480px)` 响应式样式 → 手机看就是手机布局
3. 登录成功 → `router.push(redirect)` → `/m/jobs/123` → `MobileLayout` 渲染

根路径和桌面 dashboard 会分流到移动首页；其他桌面深链按 `MOBILE_DEEPLINK_MAP` 分流。`/monitor/workflow-runs/:id` 进入移动运行页，`/workflow/viewer/:id` 进入移动定义页，`/m/*` 原生深链保留。

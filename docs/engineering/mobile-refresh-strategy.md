# 移动端数据刷新策略

**状态**: Accepted
**日期**: 2026-05-16
**适用范围**: `src/views-mobile/*` 所有移动 PWA 页面

---

## 1. 为什么不用 SSE

桌面端不少页(`/observability/outbox`、`/m/catchup` 对应桌面的 `/scheduler/catch-up-approvals`、
`/files/list` 等)有 SSE 推流;**移动端故意不接 SSE**:

| 维度 | SSE | 短轮询 |
|---|---|---|
| **弱网鲁棒** | 长连接经常被中断器/proxy/NAT 杀;断后重连发风暴 | 每次新请求独立,断网期间页面冻结一次,恢复后下次自动 catch up |
| **电耗 (4G/5G)** | 长连接保活心跳持续唤醒 radio | 单次请求完毕进入 deep sleep,显著低耗 |
| **后台行为** | iOS PWA 进后台,SSE 多数被系统挂起;再前台时连接断 | `useAutoRefresh` 已挂 visibilitychange,后台 0 请求 |
| **服务端压力** | 每移动用户保活一条 TCP | 每用户 30s 一次 HTTP |
| **实现复杂度** | 需要重连退避 / 心跳 / Last-Event-ID | `setInterval` |

移动端是**oncall 应急定位**形态(从 push / 邮件 / 扫码 入页),不是"长时间盯屏"。
30s 内的延迟用户无感。

## 2. 统一的轮询档位

参见 [`src/layout-mobile/composables/refreshIntervals.ts`](../../src/layout-mobile/composables/refreshIntervals.ts)。

| 档 | 时长 | 何时用 | 例子 |
|---|---|---|---|
| **HOT** | 10s | 详情运行中、workflow run overlay,oncall 必须看着翻转 | `MJobInstanceDetail`(运行态时短轮询)、`MWorkflowViewer`(有 runId 时) |
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

## 4. 何时考虑迁回 SSE

如果未来出现以下场景,可重新评估:
- 移动端要做实时协作(多人同时操作同一审批,需要锁状态推送)
- 4G/5G 流量价格大幅下降,且系统已上 HTTP/3
- 监控周期被产品压到 < 5s

当前不在该 critical path。

## 5. 深链 + 登录流转

PWA push / 邮件 / 扫码 进入未登录态时:

1. `/m/jobs/123` → router guard 未登录 → `/login?redirect=/m/jobs/123`
2. `Login.vue` 自带 `@media (max-width: 480px)` 响应式样式 → 手机看就是手机布局
3. 登录成功 → `router.push(redirect)` → `/m/jobs/123` → `MobileLayout` 渲染

**`MOBILE_AUTO_REDIRECT_PATHS = {'/', '/ops/summary'}`** 是白名单,**只有访问根路径或桌面 dashboard
才会被自动转 `/m/ops/summary`**;深链 `/m/*` 始终保留 mobile 路由,不会被覆盖。

`/m/workflow/:id?runId=NNN` 是 2026-05-16 新增的 mobile 只读 workflow viewer,沿用同套机制。


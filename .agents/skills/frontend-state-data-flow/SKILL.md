---
name: frontend-state-data-flow
description: 修改或审查 Vue/Pinia/TanStack Query、租户切换、分页、刷新、轮询、缓存、SSE/进度和页面数据加载逻辑时使用。
---

# 前端状态与数据流治理

## 数据来源

- API 调用集中在 `src/api`，页面通过 API 封装、store 或 composable 使用，不在组件里散落请求细节。
- 依赖租户的视图使用 `useTenantReload(loadFn)`；TanStack Query 场景把 `tenant.tenantId` 放入 `queryKey`。
- `src/stores` 保存跨页面状态，页面局部 UI 状态留在组件或 composable 中，避免把临时表单状态提升为全局状态。

## 分页与刷新

- 列表默认分页为 15，`pageSizes` 包含 `[15, 30, 50, 100]`。
- 服务端分页、cursor、过滤条件、排序和导出条件要保持同源，不用前端聚合掩盖后端分页问题。
- 轮询、SSE 和手动刷新要有停止条件、错误退避和租户切换清理，避免后台页面持续打接口。

## Pipeline 与实时进度

- 进度条、步骤状态和 SSE 展示必须来自后端真实事件或状态字段，不用前端计时猜测完成度。
- 对 outbox、worker、pipeline、批量日等页面，要展示加载态、空态、错误态、权限不足和部分失败。

## 验证

- 数据流变化优先补 composable/store/util 单测，页面交互再补 Playwright。
- 重点验证租户切换、快速连续刷新、接口失败、空列表、分页越界和组件卸载后的请求清理。

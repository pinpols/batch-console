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
- 进度以完整状态推送为主，首屏、重连和reset事件读取快照；在线不周期GET，断线回退查询需退避。优先复用 `useProgressSnapshot`；用租户/资源/日期范围及读写序列拒绝旧HTTP响应覆盖新推送。
- DAG运行图以执行冻结快照为准，不用当前定义回填历史；根运行终态且节点无运行记录应明确标示无记录，不能当作成功。成功数、收口数与计划/运行/任务各层分母分开。
- 执行／等待／失败位置由冻结节点快照派生，保留并行节点；根运行的 `currentNodeCode` 可能是结束游标，不能据此声称 END 实际执行。未物化节点与冻结图中的 NOT_EXECUTED 投影分别核对，切租户／运行时不沿用旧范围位置。
- JOB节点保留Workflow节点状态与关联Job实例状态两种事实；节点仍为READY而实例已RUNNING/PAUSED时，仅在显示层合成进度状态，不改写调度语义或增加逐节点轮询。
- 手工构造EventSource地址应走 `src/api/stream.ts` 公用地址构造；生产根地址 `/` 不得拼成协议相对地址 `//api/...`。保留根地址与绝对前缀回归。
- 图表放在对应运维任务上下文：租户每日总览在运维首页，Workflow节点状态在运行详情，作业阶段/分区/任务在作业详情；计划覆盖不足不计算完整百分比。
- 对 outbox、worker、pipeline、批量日等页面，要展示加载态、空态、错误态、权限不足和部分失败。

## 验证

- 数据流变化优先补 composable/store/util 单测，页面交互再补 Playwright。
- 重点验证租户切换、快速连续刷新、接口失败、空列表、分页越界和组件卸载后的请求清理。

## Pipeline当前阶段与历史明细

- 文件Pipeline页用`useLivePipelineProgress`按当前页ID集合订阅`/api/console/pipeline-progress/events`，不再通过dirty事件刷新或固定轮询。旧单实例查询仅保留兼容，当前页文件摘要也走新完整快照。
- 当前阶段概览由运行版本目录与每阶段最新尝试组成；历史步骤表保留服务端分页，不把新重试插进旧页。未知版本只展示实际阶段，不用最新字典补历史图。
- Job实时行数仅对精确stepRunId/runSeq的运行尝试补持久空值；Job或步骤已终态、旧尝试、已存在持久值时不吸收缓存。状态由后端裁决，前端不计时模拟。

- 处理行数或总量未知时不估算ETA，不能把null计数当成0；已有采样历史不改变这个边界。深链指定Pipeline必须走精确ID过滤并在标签切换时保留范围，不能靠模糊keyword关联历史实例。
- Console中的步骤/尝试身份匹配与Orchestrator源缓存的任务认领/租约隔离是不同证据；后者需要检查实际过滤和真实Worker场景，不能以前者通过替代。

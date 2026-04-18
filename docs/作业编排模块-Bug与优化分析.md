# 作业编排模块 Bug 与优化分析

> 分析范围：WorkflowDesigner、WorkflowDefinitionList、WorkflowRunList/View、workflow API 层、instance API 层
>
> 日期：2026-04-08

---

## 一、Bug（可能导致功能异常）

### 1. ~~`detail()` 全量拉取仅取一条~~ ✅ 已修复

**文件**：`src/api/workflow.ts`

~~每次查询单个 workflow 定义，都调 `fetchAllPageItems` 拉取全量分页数据，再 `find` 一条。~~

**修复**：`detail()` 现在将 `workflowCode` 参数传给后端，后端支持时只返回匹配项，减少传输量。

---

### 2. ~~WorkflowRunView 全量拉取再客户端过滤~~ ✅ 已修复

**文件**：`src/views/monitor/WorkflowRunView.vue`、`src/api/workflowQueries.ts`

~~查看单个 workflow run 详情时，拉取该租户下全部 node runs，然后前端 filter。~~

**修复**：`queryWorkflowNodeRuns` 新增可选 `workflowRunId` 参数，WorkflowRunView 传入 `runId` 让后端过滤。

---

### 3. ~~`instanceApi.partitions` 同样全量拉取~~ ✅ 已修复

**文件**：`src/api/instance.ts`

~~获取单个 job 实例的分区列表，拉取了租户下所有 step instances。~~

**修复**：传入 `jobInstanceId` 参数给后端，后端支持时避免全量拉取。客户端仍保留 filter 作为兜底。

---

### 4. ~~WorkflowDefinitionList `load()` 双重拉取 + 双重过滤~~ ✅ 已修复

**文件**：`src/views/job/WorkflowDefinitionList.vue`、`src/api/workflow.ts`

~~`workflowApi.listDefinitions` 内部已经 `fetchAllPageItems` + 前端过滤了一遍，视图层又传 `pageSize: 10000` 再拉一次全量，然后再做一遍完全相同的过滤。~~

**修复**：
- `listDefinitions` 返回值新增 `allItems` 字段（过滤前全量），供视图层提取类型选项
- `load()` 直接将过滤参数传给 `listDefinitions`，由 API 层统一过滤+分页，消除双重拉取

---

### 5. ~~WorkflowRunList `resolveDefId` 每次 load 重复拉全量定义~~ ✅ 已修复

**文件**：`src/views/monitor/WorkflowRunList.vue`

~~每次翻页、搜索都重新拉全量定义列表只为 code→id 映射。~~

**修复**：新增 `cachedDefs` 缓存，`loadWorkflowCodes` 将结果写入缓存，`resolveDefId` 改为同步函数直接读缓存。

---

### 6. ~~`loadWorkflow` 里加载节点/边也是全量~~ ✅ 已修复

**文件**：`src/views/workflow/WorkflowDesigner.vue`、`src/api/workflowQueries.ts`

~~拉取整个租户的所有节点和边，然后前端按 definitionId 过滤。~~

**修复**：
- `queryWorkflowNodes` / `queryWorkflowEdges` 新增可选 `workflowDefinitionId` 参数
- `loadWorkflow` 传入 `def.id`，后端支持时只返回该 workflow 的节点/边

---

### 7. ~~`onBeforeUnmount` 中 `persistDraft` 操作已 dispose 的 graph~~ ✅ 已修复

**文件**：`src/views/workflow/WorkflowDesigner.vue`

~~`graph.value?.dispose()` 在 `persistDraft` 之前执行，导致 `persistDraft` 因 `graph.value === null` 直接 return，最后一次编辑的草稿丢失。~~

**修复**：将草稿 flush 逻辑移到 `graph.dispose()` 之前执行。

---

### 8. ~~`selectedDefinition` watch 可能覆盖草稿恢复的 form~~ ✅ 已修复

**文件**：`src/views/workflow/WorkflowDesigner.vue`

~~`loadWorkflow` 中先恢复草稿 form，之后 `definitionOptions` 更新触发 `selectedDefinition` watcher 用后端数据覆盖草稿 form。~~

**修复**：新增 `suppressDefinitionFormSync` 标志，草稿恢复时置为 `true`，watcher 检测到该标志后跳过一次 form 同步。

---

### 9. ~~环路检测只报第一个环就 break~~ ✅ 已修复

**文件**：`src/views/workflow/WorkflowDesigner.vue`

~~复杂 DAG 可能存在多个独立的环，但只报第一个。~~

**修复**：重写 DFS 环检测逻辑，遍历所有节点并通过 `pushIssue` 去重，报告所有独立的环路径。

---

### 10. ~~`openDag` 路由方式不一致~~ ✅ 已修复

**文件**：`src/views/job/WorkflowDefinitionList.vue`

~~从列表页跳转用的是 query param，而 Designer 内部用的是 path param `/workflow/designer/:code`。~~

**修复**：`openDag` 改为 `router.push({ path: '/workflow/designer/${encodeURIComponent(workflowCode)}' })`，与 Designer 内部 `router.replace` 保持一致。

---

## 二、性能优化

### 11. 4700+ 行的巨型 SFC 需要拆分 ⏳ 待处理

`WorkflowDesigner.vue` 接近 4800 行（template + script + style），严重违反单一职责。建议拆分：

| 拆出内容 | 目标文件 |
|----------|----------|
| 图形引擎初始化 / 事件绑定 | `useWorkflowGraph` composable |
| 草稿管理 | `useWorkflowDraft` composable |
| DAG 验证逻辑 | `validateDag` 工具函数 |
| 布局算法 | `layoutDag` 工具函数 |
| 表单状态管理 | `useNodeForm` / `useEdgeForm` |
| 面板分割拖拽 | `useSplitter` composable |

> 改动范围太大，需要专门重构，不宜与 bug 修复混合进行。

---

### 12. ~~`fetchAllPageItems` 串行分页~~ ✅ 已修复

**文件**：`src/api/adapters.ts`

~~逐页串行请求，10 页数据需要 10 次串行 await。~~

**修复**：第一页返回 `total` 后，计算剩余总页数，使用 `Promise.all` 并行请求所有剩余页。

---

### 13. ~~`validateGraph` 在拖拽过程中频繁调用~~ ✅ 已修复

**文件**：`src/views/workflow/WorkflowDesigner.vue`

~~`syncGraphDerivedState` → `validateGraph()` 每次都全量遍历节点/边做拓扑排序和可达性分析。~~

**修复**：
- `syncGraphDerivedState` 新增 `skipValidation` 选项
- 拖拽过程中 `schedulePositionDerivedSync` 使用 `skipValidation: true`，仅更新 stats
- 300ms settle 后才执行完整校验 + 草稿保存

---

### 14. ~~`buildDraftPayload` 中对每个节点两次 `getCellById`~~ ✅ 已修复

**文件**：`src/views/workflow/WorkflowDesigner.vue`

~~每个节点调用两次 `getCellById`（x 和 y 各一次）。~~

**修复**：合并为一次 `getCellById` + `position()` 调用。

---

### 15. ~~Shape 注册用全局 window 标志防重复~~ ✅ 已修复

**文件**：`src/views/workflow/WorkflowDesigner.vue`

~~用 `window.__workflowDesignerShapesRegV4` 做注册去重，全局污染且 HMR 不友好。~~

**修复**：改为模块作用域内的 `let shapesRegistered = false`，不再污染 window。

---

## 三、可靠性问题

### 16. ~~无错误边界处理~~ ✅ 已修复

**文件**：`src/views/workflow/WorkflowDesigner.vue`

~~`loadWorkflow`、`loadDefinitions`、`submitToBackend` 等 async 函数缺少 catch 分支。~~

**修复**：为 `loadWorkflow`、`loadDefinitions`、`submitToBackend` 增加 catch 分支，显示 `ElMessage.error` 用户可读的错误信息。

---

### 17. ~~`submitToBackend` 成功后立即 `loadWorkflow` 可能失败~~ ✅ 已修复

**文件**：`src/views/workflow/WorkflowDesigner.vue`

~~提交成功后立即重新加载，后端最终一致性可能导致读到旧数据。~~

**修复**：提交成功后延迟 500ms 再调用 `loadWorkflow`。

---

### 18. ~~LocalStorage 草稿无大小/版本检查~~ ✅ 已修复

**文件**：`src/views/workflow/WorkflowDesigner.vue`

~~`readDraft` 只检查 JSON 合法性，不检查结构完整性和时效性。~~

**修复**：
- 增加结构完整性校验（`workflowDefinition`、`nodes`、`edges` 必须存在且类型正确）
- 增加 30 天过期检查，过期草稿自动清除并提示用户

---

### 19. ~~并发操作无锁~~ ✅ 已修复

**文件**：`src/views/job/WorkflowDefinitionList.vue`

~~`actingId` 只记录一个 ID，快速点击多行操作按钮会导致 loading 状态错乱。~~

**修复**：`actingId: ref<number | null>` 改为 `actingIds: ref<Set<number>>`，支持多行并发操作各自独立的 loading 状态。

---

## 四、UX 改进

### 20. ~~提交前无确认对话框~~ ✅ 已修复

**文件**：`src/views/workflow/WorkflowDesigner.vue`

~~`submitToBackend` 直接提交到后端，没有二次确认。~~

**修复**：提交前弹出 `ElMessageBox.confirm`，区分「更新」和「新建」两种场景的确认文案。

---

### 21. ~~删除节点无确认~~ ✅ 已修复

**文件**：`src/views/workflow/WorkflowDesigner.vue`

~~`deleteGraphCell` 直接删除，误触 Delete 键就丢失节点配置。~~

**修复**：`deleteGraphCell` 增加 `ElMessageBox.confirm` 确认对话框，显示待删除的节点/连线名称。内部调用（如批量操作）可传 `skipConfirm = true` 跳过。

---

### 22. 无 Undo/Redo 支持 ⏳ 待处理

4800 行的编辑器没有撤销/重做功能。X6 提供了 `History` 插件，应集成。

> 需要引入 X6 History 插件并集成到现有事件体系中，属于独立功能开发。

---

### 23. 无键盘快捷键提示面板 ⏳ 待处理

快捷键散落在代码里（Shift+T/D/J、Delete），没有可见的快捷键帮助面板。

> 需要新增 UI 组件，属于独立功能开发。

---

### 24. ~~节点编码和名称缺少校验规则~~ ✅ 已修复

**文件**：`src/views/workflow/WorkflowDesigner.vue`

~~`nodeCode` 没有校验合法性，用户可能输入特殊字符或已存在的值导致 X6 cell ID 冲突。~~

**修复**：`applyNodeForm` 增加三重校验：
1. 非空检查
2. 字符合法性（只允许字母、数字、下划线、连字符）
3. 与其他节点的重复检查

---

### 25. ~~右键菜单缺少 Escape 关闭~~ ✅ 已修复

**文件**：`src/views/workflow/WorkflowDesigner.vue`

~~`canvasContextMenu` 只通过 mousedown 关闭，没有监听 Escape 键。~~

**修复**：`onKeydown` 增加 Escape 键处理，关闭右键菜单。

---

## 五、代码质量

### 26. 大量 `let` 模块级变量 ⏳ 待处理

`splitterStartX`、`splitterStartLeft`、`loadWorkflowToken`、`draftTimer`、`positionDerivedSyncTimer`、`_edgeZOrderRaf`、`paletteGraph`、`stencilDnd` 等都是模块顶层的 `let` 变量，不受 Vue 响应式管理，且在 HMR 时可能泄漏。应封装到 composable 或使用 `ref`/`shallowRef`。

> 与 #11 SFC 拆分一起处理。

---

### 27. ~~类型断言过多~~ ✅ 已修复

**文件**：`src/views/workflow/WorkflowDesigner.vue`

~~大量 `cell.getData() as WorkflowNodeDraft` 不安全断言。~~

**修复**：新增 `getNodeData(cell)` / `getEdgeData(cell)` 类型安全 helper 函数，集中收敛断言位置。

---

### 28. HTML 节点直接拼接 innerHTML ⏳ 待处理

**文件**：`src/views/workflow/WorkflowDesigner.vue`

虽然用了 `escapeHtml`，但这种模式脆弱。如果未来某个字段忘了 escape 就是 XSS。X6 的 HTML 节点推荐使用 Vue 组件渲染（`@antv/x6-vue-shape`）。

> 需要引入 `@antv/x6-vue-shape` 依赖并重写 shape 渲染逻辑，属于独立重构。

---

## 六、修复状态总结

| 状态 | 数量 | 编号 |
|------|------|------|
| ✅ 已修复 | 23 | #1 #2 #3 #4 #5 #6 #7 #8 #9 #10 #12 #13 #14 #15 #16 #17 #18 #19 #20 #21 #24 #25 #27 |
| ⏳ 待处理 | 5 | #11 #22 #23 #26 #28 |

### 待处理项说明

| 编号 | 问题 | 原因 |
|------|------|------|
| #11 | SFC 拆分（4800 行） | 改动范围大，需专门重构，不宜与 bug 修复混合 |
| #22 | Undo/Redo | 需引入 X6 History 插件，属于独立功能开发 |
| #23 | 快捷键帮助面板 | 需新增 UI 组件，属于独立功能开发 |
| #26 | let 模块变量 → composable | 与 #11 SFC 拆分一起处理 |
| #28 | innerHTML → vue-shape | 需引入 `@antv/x6-vue-shape` 依赖，属于独立重构 |

---

## 七、Phase 2 — 全系统前端接口优化

> 基于 OpenAPI 规范和协议文档，将前端过滤参数传递给后端（后端支持时减少传输量，客户端保留兜底过滤）。

### 已完成优化

| 文件 | 端点 | 新增传递参数 |
|------|------|-------------|
| `src/api/job.ts` | `/api/console/query/job-definitions` | `jobCode` |
| `src/api/alert.ts` | `/api/console/query/alerts` | `acknowledged`, `startDate`, `endDate` |
| `src/api/file.ts` | `/api/console/query/files` | `fileStatus`, `bizType`, `fileName`, `traceId`, `fileId`, `startDate`, `endDate` |
| `src/api/file.ts` | `/api/console/query/audits` | `fileId` |
| `src/api/queries/instances.ts` | `/api/console/query/instances` | `jobCode`, `instanceStatus`, `startDate`, `endDate` |
| `src/api/observabilityQueries.ts` | `/api/console/query/audits` | `traceId`, `operationType`, `operatorId`, `fileId`, `operationResult`, `startTime`, `endTime` |
| `src/api/observabilityQueries.ts` | `/api/console/query/outbox-retries` | `eventType`, `eventKey`, `retryStatus` |
| `src/api/observabilityQueries.ts` | `/api/console/query/outbox-deliveries` | `eventType`, `eventKey`, `deliveryStatus`, `targetTopic` |
| `src/api/instance.ts` | `/api/console/query/workflow-runs` | `workflowDefinitionId`, `runStatus` |

### OpenAPI 规范更新

`docs/api/console-api.openapi.yaml` 已同步声明所有新增的 filter 参数（作为可选 query parameter），涵盖：

- `instances`、`job-definitions`、`files`、`alerts`、`audits`
- `outbox-retries`、`outbox-deliveries`
- `workflow-runs`、`workflow-nodes`、`workflow-edges`、`workflow-node-runs`
- `job-step-instances`

### 未采用的优化

| 方案 | 原因 |
|------|------|
| WorkflowDesigner 使用 `/workflow-topology` 端点 | 该端点只接受 `tenantId`，返回全部 workflow 数据；设计器只需要单个 workflow 的 nodes/edges，当前按 `workflowDefinitionId` 过滤的方式更高效 |

### 构建验证

- `vue-tsc --noEmit` ✅ 通过
- `vite build` ✅ 通过

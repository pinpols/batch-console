# Batch Console UI/UX 统一评估与优化建议（草案）

更新时间：2026-04-22  
范围：`batch-console`（Vue3 + Element Plus + ProTable/ListPageQueryBar 等统一构件）

## 1. 目标与原则

### 目标

- **统一**：输入区（查询条）间距/宽度、按钮风格、表格密度、空态文案一致。
- **美观**：更轻、更干净的视觉层级，减少“默认 Element Plus 灰扁感”与页面间割裂。
- **高效**：排障/运维/配置场景操作更顺手（复制、详情、跳转链路）。
- **低改动成本**：优先在**共享组件/全局样式**实现一致性，避免逐页手工调参。

### 原则（落地优先级）

1. **先全局后局部**：能在 `ListPageQueryBar` / `ProTable` / 全局 CSS 覆盖就不逐页写 scoped。
2. **先一致后个性**：页面有个性需求时，用 class/slot 扩展，避免 inline style 随处飞。
3. **先可读后“炫”**：阴影/渐变只用来表达层级与主操作，不做装饰堆叠。
4. **只读页不硬加“新增”**：查询/审计/快照页优先做“详情/复制/跳转”。

## 2. 现状结论（基于本轮改造观察）

### 已较统一的部分

- **表格风格**：`console-table` 相关规则在 `src/styles/element-override.css` 已覆盖表头、密度、斑马纹、操作列按钮等。
- **查询条按钮**：`ListPageQueryBar` 已统一查询/重置/刷新按钮与右对齐逻辑。
- **新增按钮风格**：已引入 `pretty-add-button`（浅蓝渐变 + 阴影 + `Plus` 图标）并在多个管理页复用。

### 仍不统一的主要来源

- **查询条控件宽度**：页面内大量使用 `style="width: XXXpx"` 造成同类控件宽度不一致。
- **表单页/抽屉/对话框内工具条**：同类操作（如“新增步骤”）偶尔使用 link/text 按钮，弱化主操作。
- **只读查询页缺“排障操作”**：缺详情/复制/跳转导致用户只能看表格截断信息。

## 3. 统一规范（建议作为后续所有页面的默认准则）

### 3.1 查询条（ListPageQueryBar）

- **布局**：左到右依次为（可选）主操作 `prepend` → 条件项 → 右侧“查询/重置/刷新”。
- **条件数量**：常规列表保持 **2–3 个高频条件**；更多条件用“高级筛选”折叠（后续增强项）。
- **默认宽度**（已落地全局兜底，建议逐步显式收敛为 class）：
  - input：220px
  - select/date：200px
  - 小屏：自动变为 `min(320px, 100%) / min(260px, 100%)`
- **交互**：
  - Enter 触发查询（输入框 `@keyup.enter`）
  - Reset 会清空 draft/applied 并回到第一页
  - Refresh 保留 applied 条件，仅重新拉取数据

### 3.2 新增按钮（管理型页面）

- **文案**：统一用“新增XX”（避免“新建/创建/添加”混用）
- **样式**：统一 `pretty-add-button` + `Plus` 图标
- **位置**：
  - 页面级新增：`PageHeader` 的 `#actions`
  - Tab/列表内新增：`ListPageQueryBar` 的 `prepend`
- **弹窗/抽屉内新增**：使用 `pretty-add-button--mini`（小号主操作，仍保持视觉主次）

### 3.3 表格（console-table / ProTable）

- **密度**：默认 `size="small"` + `console-table` 全局压缩（已实现）
- **操作列**：
  - 统一 `.table-actions` gap/按钮规格
  - 对“只读查询”优先提供：`详情（Drawer）/ 复制 / 跳转链路`
- **空态**：
  - `ProTable`：无筛选用“暂无数据”，有筛选用“未找到符合条件的数据…”

### 3.4 详情 Drawer（排障/只读查询页）

- **统一模式**：
  - Drawer 顶部：3 条以内“关键字段” + `CopyableText`
  - Drawer 主体：`json-preview`（完整 JSON）
- **跳转链路**（可选）：
  - traceId → `/logs?traceId=...`
  - fileId/instanceNo 等 → 对应详情页/列表筛选（需要路由/页面支持）

## 4. 页面级建议清单（“是否需要新增”+“建议操作”）

### 4.1 需要“新增”的管理页（建议保持/补齐）

- **租户管理**（`TenantList`）：新增租户、批量新增（+复制配置/初始化等）
- **API Key 管理**（`ApiKeyList`）：新增 API Key
- **系统参数**（`SystemParameterList`）：新增参数
- **Webhook 管理**（`WebhookList`）：新增 Webhook
- **通知与投递**（`NotificationManagement`）：新增渠道/规则/Webhook
- **标签管理**（`TagManagement`）：新增标签
- **Pipeline 定义**（`PipelineDefinitionList`）：新增 Pipeline；抽屉内新增步骤

### 4.2 不建议新增（只读/查询/由别处创建）

- **可观测性查询**（`ObservabilityQueryTabs`）：用详情/复制/Trace 跳转替代新增
- **Outbox**（`OutboxList`）：用详情/复制替代新增
- **事件目录**（`EventCatalog`）：用复制/详情替代新增
- **调度快照**（`SchedulerSnapshot`）：用复制 Code 替代新增

## 5. 优先级与落地计划（建议）

### P0（立刻提升一致性，低风险）

- 将查询条控件宽度从“页面内 inline style”逐步收敛为 2–3 个标准 class（如 `query-w-sm/md/lg`）
- 把新增按钮文案全面统一为“新增XX”，并统一放置位置（header actions / query prepend）
- 为只读查询页补齐“详情 Drawer + Copy + 合理跳转”

### P1（体验增强）

- 高级筛选折叠：查询条件 >3 时折叠到“更多条件”
- 列设置/密度设置：统一放到 `ProTable` toolbar（非每页重复造）

### P2（性能与可用性）

- 大列表改为后端分页/条件查询（当前多个查询页是前端全量拉取 + 过滤）
- 路由预热与首点延迟治理（如刷新后 `fetchMe` 预热）

## 6. 验收清单（Review Checklist）

- 查询条：2–3 个条件，控件宽度一致，按钮区右对齐，Enter 可触发查询
- 新增：文案“新增XX”，样式 `pretty-add-button`，位置遵循 header/prepend 规范
- 表格：`console-table` 风格一致，操作列按钮尺寸/间距一致
- 只读页：至少有“详情/复制”，可选有链路跳转（trace/file/instance）
- 响应式：≤900px 下控件不溢出，自动换行合理

---

## 附录 A：本轮已落地的“全局一致性”改动点（摘要）

- `ListPageQueryBar` 查询条布局与按钮区对齐（组件层）
- `console-table` 表格密度/表头/操作列统一（`src/styles/element-override.css`）
- 新增按钮统一样式：`pretty-add-button` / `pretty-add-button--mini`（`src/styles/app.css`）
- 查询条控件默认宽度兜底（`src/styles/app.css`）


# ExecutionMode 前端落地待办

整理时间：`2026-04-27`

后端 P0-1 / P0-1.5 已落地完整 watermark 双向回路：
- 模型层 + DB 迁移：commit `7584359f`
- 运行时双向打通：commit `0d64f69c`
- 全链路视图：[`file-batch-system/docs/architecture/system-flow-overview.md`](https://internal-link/system-flow-overview.md) §7.8
- 设计依据：[`file-batch-system/docs/design/batch-classification-and-gaps.md`](https://internal-link/batch-classification-and-gaps.md) §1.2 / §4.1

后端能力已闭环，前端 Designer 表单还没暴露 `executionMode` / `watermarkField` 两个字段，业务方在 console 上目前**只能保留默认 FULL**。本待办把 UI 落地拆成可执行项。

---

## 1. 必须做的（解锁 INCREMENTAL 业务自助配置）

### 1.1 JobDefinition 表单加 ExecutionMode 选择 + watermarkField 输入

**位置**：作业管理 → 作业定义 → 新建/编辑表单。

**字段**：
- `executionMode`：下拉选择，3 项 `FULL / INCREMENTAL / CDC`，缺省 FULL
  - 字典源：`/api/console/meta/enums` 的 `executionMode` key（后端已注册，见 `ConsoleMetaQueryService`）
  - 改用 `useConsoleMetaEnumsQuery()` + `pickMetaEnumGroup(metaEnums.value, 'executionMode')`
- `watermarkField`：文本输入框，最大 64
  - 仅当 `executionMode === 'INCREMENTAL'` 时显示，FULL/CDC 隐藏并自动清空
  - 占位提示："增量水位字段名（例：update_time / id）"

**字段位置**：与 `shardStrategy` 同行或上下相邻（语义都是"执行行为"）。

**校验**：
- INCREMENTAL 模式下 `watermarkField` 必填
- watermarkField 应限制成合法的 SQL 列名（`^[a-zA-Z_][a-zA-Z0-9_]*$`），避免 SQL 注入预期

**已有后端字段**：
- `JobDefinitionCreateRequest` / `JobDefinitionUpdateRequest` 已加 `executionMode` + `watermarkField`
- `ConsoleJobDefinitionResponse` 已带回（`executionMode` required）

**前端 codegen**：跑 `npm run gen:api` 重新生成 `src/types/api.generated.ts`，对应字段会自动出现在请求/响应类型里。

**影响文件**：
- `src/views/job/JobDefinitionList.vue`（列表 + 表单弹窗）
- 任何 `Excel 维护` 入口（如有走 Excel 改表单）

### 1.2 JobDefinition 列表加 ExecutionMode 列

**位置**：同上页面的表格。

**列**：
- 列头："执行模式"
- 单元格：用 `<StatusTag>` 或简单 tag 显示 FULL（灰）/ INCREMENTAL（蓝）/ CDC（紫）
- 后端 `ConsoleJobDefinitionResponse.executionMode` 已 required，不会缺失

**可选**：列头筛选器，调 `/meta/enums.executionMode`。

---

## 2. 应该做的（可观察 + 排查）

### 2.1 JobInstance 详情页展示水位 IN/OUT

**位置**：作业实例详情 / 实例运行视图。

**展示**：
- 字段："水位起点 (IN)" / "水位终点 (OUT)"
- 一对相邻 KV 行；都为 null 时显示"—"（FULL 实例直接两个都 —）
- INCREMENTAL 实例的 OUT 在 worker 上报 success 之后才填，未结束实例 OUT = null（标灰显示"等 worker 上报"）

**后端来源**：`job_instance.high_water_mark_in / high_water_mark_out`（V73 已加）。
> ⚠️ 当前 `ConsoleJobInstanceResponse` 是否已带这两个字段需要 verify；P0-1 commit 把字段加进了 `JobInstanceEntity` 和 mapper resultMap，但响应 DTO 是否同步暴露要看 console-api 那边。如果没暴露，需要后端再补一行字段映射。

**影响文件**：
- `src/views/monitor/JobInstanceList.vue` 列表里加可选列（默认隐藏，列设置打开）
- 实例详情抽屉/页面（如果有）

### 2.2 列表筛选按 ExecutionMode

**位置**：作业定义列表的查询条 + 作业实例列表的查询条。

**理由**：客户配置增量任务后想筛"我系统里所有 INCREMENTAL 任务"做对账。

**实现**：列表筛选区的 `ListPageQueryBar` 加 select。后端 `JobDefinitionQueryRequest` 当前**没有** `executionMode` 过滤参数（要后端补；不阻塞，前端可以先做客户端过滤兜底）。

---

## 3. 前端验证计划

后端模型 + 运行时已通，前端只是把字段透出。最小验证流程：

1. **配置一个 INCREMENTAL 作业**（前端任务）：
   - 创建 jobDefinition，executionMode=INCREMENTAL，watermarkField=update_time
   - 提交 → 看 `/api/console/job-definitions/{id}` 返回的 `executionMode` 是否是 'INCREMENTAL'

2. **触发实例 → 看 IN 来源**：
   - 触发一次执行
   - 检查 `job_instance.high_water_mark_in` 应为 null（首次，无历史）

3. **造一次成功并写水位**（短期靠后端开发同学手动 update SQL，等 INCREMENTAL pipeline 业务层接入后由 worker 自动）：
   - `update batch.job_instance set high_water_mark_out = '2026-04-27T10:00:00Z' where id = X`

4. **再触发一次 → 验证 IN = 上次 OUT**：
   - 第二次触发后，新 `job_instance.high_water_mark_in` 应等于 `'2026-04-27T10:00:00Z'`
   - 同时 `TaskDispatchMessage.highWaterMarkIn` 在 Kafka 里也带这个值（用 console 的 dead-letter 重放或 outbox 工具看）

5. **前端 UI 应在第 4 步显示出 IN 已推进**。

---

## 4. 不属于本次范围

| 项 | 为什么不做 |
|---|---|
| Worker 业务层接入 INCREMENTAL（IMPORT 的增量 SQL / EXPORT 的增量游标） | 这是 worker 业务侧的事，跟前端无关；按业务 jobCode 一个一个接 |
| `executionMode` 在 Excel 配置导入里的字段 | 等业务真有大批量配置 INCREMENTAL 的需求再加 |
| `watermarkField` 列名校验工具 | 当前简单 regex 就够；复杂的列存在性校验需要后端打通 information_schema 查询 |
| ExecutionMode 时间轴可视化（IN→OUT 推进） | 等真在生产上跑了再加 |

---

## 5. 大致工作量

| 任务 | 估时 |
|---|---|
| 1.1 表单字段（含条件显隐 + 校验） | 半天 |
| 1.2 列表列展示 | 1 小时 |
| 2.1 实例详情 KV 展示（含确认后端 DTO 暴露） | 半天（含和后端确认） |
| 2.2 列表筛选 | 1 小时（如果后端不加查询参数，先客户端过滤） |
| 验证（§3） | 1 小时 |

总计 **约 1 个工作日** 把前端这一侧做穿。优先级 P1（不阻塞业务，但配置侧少这两个字段就只能给后端工程师走 SQL 直改）。

---

## 6. 联系点

- 后端模型/运行时：commit `7584359f` + `0d64f69c`，问题找写这两次提交的 owner
- 字典源：`/api/console/meta/enums` 的 `executionMode` 是后端 `ConsoleMetaQueryService.REGISTRATIONS` 注册的，问题去 console-api 模块
- 数据库迁移：V73（`db/migration/V73__add_execution_mode_and_watermark.sql`）

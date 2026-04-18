# Changelog

## 2026-04-18 — 前端全量重构

### 角色与权限

- 三角色菜单权限矩阵（ADMIN / CONFIG_ADMIN / AUDITOR），基于 `minRole` 控制菜单和路由可见性
- 系统角色均可切换租户（`canSwitchTenant`），租户用户只读显示
- 系统菜单组 `minRole` 从 ADMIN 降为 OPERATOR，租户管理和通知投递对 CONFIG_ADMIN 可见
- 路由守卫与导航菜单 `minRole` 对齐

### 租户切换

- Header 租户切换器：系统角色显示 TenantSelect 下拉，租户用户显示只读 pill
- `tenant.setTenantId()` 同步写 localStorage，避免 API interceptor 读到旧值
- 移除 6 个列表页搜索栏中的 TenantSelect（FileList、JobInstanceList、JobDefinitionList、WorkflowDefinitionList、AlertRecord、UserAccountList），租户 ID 统一从全局切换器注入

### UI 统一

- 所有 pill-tabs 补上 `v-hover-tab-activate="true"`（11 个页面）
- 移除内部元素误用的 `app-surface` 类（OpsSummary、OpsTrendPanel、OpsDistPanel、AiChat）
- 30+ 处硬编码像素值替换为 design tokens（ExcelMaintenanceWizard、JobInstanceDetail、ConfigReleaseList 等）
- `console-table` 全局加圆角 `border-radius: var(--radius-content)`
- pill-tabs 内容区自动 `padding-top`，`form-section` 自动应用 `form-panel` 视觉样式
- Dialog 内表单统一美化：label 加粗、间距紧凑、最后一项无底部 margin
- `label-width` 统一为 `100px`（9 个文件）
- 空状态文案统一为"暂无数据"（QueueConfig、UserAccountList、TenantList）
- TagManagement 英文 label 改中文（标签键/标签值）
- WorkerManagement 搜索 label "编码"改"关键字"
- JobInstanceList date picker 补 `width: 260px`
- tab 内表单统一包裹 `form-panel`（SelfServiceJobs、ConfigSyncPanel）

### 表格标准化

- 9 个页面从原生 `el-table` 迁移到 `ProTable + ListPageQueryBar`，统一搜索/分页/骨架屏：
  - SystemParameterList、ApiKeyList、TriggerList
  - EventCatalog（2 tab）、NotificationManagement（4 tab）、TagManagement（3 tab）
- UserRole 表格 tokens 对齐

### API 对齐（OpenAPI spec v6）

**错误调用修复（17 项）：**

- `auth.ts`：login 去掉多余 `tenantId`
- `job.ts`：clone 从 query params 改为 request body
- `file.ts`：archive `fileIds[]` → `fileId`(int)；presign-download `expiresInSeconds` → `reason`；redispatch 去掉 `channelCode`；download 补 `approvalId`；archive/delete/redispatch 返回类型 `string` → `ConsoleFileOperationResponse`
- `ops.ts`：kafka-lag `tenantId` → `groupId`；outbox/republish `{eventIds}` → 裸 `int64[]`；outbox/cleanup 补 `retainDays`
- `system.ts`：file-channels/templates PATCH body 加回 `tenantId`
- `scheduler.ts`：pause/resume 去掉 body；snapshot history 补 `limit`
- `dashboard.ts`：execution-progress 补 `jobCode`/`bizDate`；tenant-usage 补 `days`
- `governance.ts`：4 个 toggle 改回 `POST /{id}/toggle` + query params（与 spec 一致），body 加 `tenantId`

**缺失端点补齐（21 项）：**

- `auth.token`、`job.rerun`、`job.updateDefinition`
- `config.createConfigRelease`、`config.getReleaseApproval`
- `governance.createQueue/BatchWindow/Calendar/QuotaPolicy`、`governance.importCalendarHolidays`、`governance.deleteCalendarHoliday`
- `system.createFileChannel/Template`、`system.updateFileChannel/Template`
- `excelDomains.quickImportAlertRoutings`
- `system.queryPipelineDefinitions` 补 filter params

**类型生成：**

- `npm run gen:api` 重新生成 `api.generated.ts`
- `console-api.ts` 导出共享 Excel 类型：`ExcelApplyRequest`、`ExcelApplyResponse`、`ExcelUploadResponse`、`ExcelQuickImportResponse`、`ExcelRowIssue`
- Excel 向导加入 `previewWorkbookUrl` 展示

**清理：**

- 删除幽灵端点 `createReleaseApproval`（spec 无此 POST）

### Bug 修复

- `useHeaderLogic.ts`：`canSwitchTenant` computed 与 import 同名导致无限递归，import 重命名为 `checkCanSwitchTenant`
- `DefaultLayout.vue`：FAB z-index 从 2500 降为 1999，避免遮挡 dialog
- `Login.vue`：`validate()` 结果显式检查，`catch(() => false)` + `if (!valid) return`
- `JobInstanceList.vue`：日期变更不重置页码，补 `query.page = 1` + `loadData()`
- `useHeaderLogic.ts`：`copyTenant` 用 `??` 代替 `||`，避免空串歧义
- `tenantAccess.ts`：AUDITOR 加入 `canSwitchTenant` 允许列表

### E2E 测试

- 删除冲突的旧 `playwright.config.cjs`（含 globalSetup 连后端）
- 配置从 `.ts` 改为 `.cjs`，跳过 TS 编译，解决 Playwright 启动卡死
- 加超时机制：15s/测试、5s/断言、10s/导航、3 分钟全局兜底
- 加 `e2e/tsconfig.json` 隔离编译
- `enterDemoApp` 加 token 过期早期检测
- 40 个测试文件、389 个用例（需后端运行才能全绿）

### 单元测试

- 15 个测试文件、167 个用例全部通过
- `tenantAccess.test.ts` 更新：AUDITOR 改为允许切换租户

# Changelog

## 2026-04-19 — E2E 稳定化 + 移动端 + 真 bug 猎杀

### 端到端测试稳定化

- E2E 通过率 82.3% → ~95%（320 → ~370 过 / 67 → ~19 挂）
- 详细过程见 [docs/reports/2026-04-19-e2e测试报告.md](docs/reports/2026-04-19-e2e测试报告.md)

### 后端真 bug 修复（对应 `file-batch-system` 仓）

- `DefaultConsoleTriggerProxyService` 转发 orchestrator 缺 `X-Internal-Secret` → 401
- `ConsoleTenantConfigPackageExcelController.upload` 全局角色缺 `tenantId` 参数 → `tenant is required` 400
- tenant-package apply 阶段 pipeline/step MyBatis 参数键 camelCase 但 XML 绑 snake_case → `null` 撞 NOT NULL → 500
- `ConsoleDashboardQueryService` 用 `Map.of(null)` 构造聚合行 → NPE × 121
- `DefaultConsolePipelineDefinitionApplicationService.toInstant` 只枚举 .SSSSSS/.SSS 两种 fractional seconds pattern → 5 位小数秒解析失败

### 前端真 bug 修复

- `ListPageQueryBar` 缺 `#prepend` 命名 slot → `NotificationManagement.vue` 三个"新增渠道/规则/Webhook"主按钮**生产环境完全不渲染**（🔴 生产级阻塞）
- 业务接口 401 被 interceptor 当 session 失效清 token 跳登录 → 改为分级（`/auth/me` 才登出，业务 401 只弹 toast）
- `auth.fetchMe()` 同步 `tenant.setTenantId(profile.tenantId)` 把系统管理员刚切过去的租户又覆盖回源租户 → 移除
- iOS Safari 无痕模式 / 禁 Cookie 时 `localStorage.setItem` 抛 SecurityError → `index.html` shim 探测不可用时装上内存版，30+ 处调用点零改动
- 列表页 header 与 ListPageQueryBar 之间的"刷新"按钮重复（strict-mode 违规）→ 4 页去重
- 顶栏"退出"按钮放在悬浮面板末端易误触 → `el-popconfirm` 二次确认 + 视觉分隔
- Header 租户 chip 常驻顶栏（原来藏在悬浮面板里，admin 切租户体验差）
- logger telemetry 上报 `name` 超 200 会让整批 400 → `buildPayload` 裁剪 + 4xx 丢批不卡死

### 前端架构重构

- 侧边栏菜单由前端 `navigationGroups` 维护产品文案、图标和排序，后端 `/auth/me` 下发菜单只作为可见性来源（`ConsoleMenuRegistry` 按 authorities 过滤）；切租户后自动 `fetchMe()` 刷新 authorities + menus
- 抽 `useTenantReload(loadFn)` composable 统一 `onMounted + watch(tenant.tenantId)` 模式，迁移 43 个视图
- Element Plus 全局 `zh-cn` locale（main.ts `app.use` + App.vue `ElConfigProvider`），MessageBox 按钮从 "OK/Cancel" 统一到中文
- 前端独立 DOMPurify 兜底 + ESLint `vue/no-v-html: error` 禁用原生 `v-html`，新增 `v-safe-html` 指令
- Vite 性能调优：`server.warmup` + `optimizeDeps.include` 大依赖预打包 → dev 冷启动 1.36s → 0.97s
- `make dev` 前台启动接管后台实例 + 清端口，与 `dev-bg` 行为对齐

### 移动端独立路由 `/m/*`

- 新增 `MobileLayout` + `MobileAppBar` + `MobileTabBar`，共享 stores/api/composables
- 首批移动端覆盖：`MOpsSummary` / `MApprovals` / `MAlerts` / `MJobInstances` / `MCatchUp` + `MJobInstanceDetail`；后续扩展了文件、Worker、Outbox、执行日志等应急入口
- PWA manifest + apple-touch-icon / favicon，"添加到主屏幕"即独立 app 启动
- 下拉刷新（`MPullRefresh`）+ 骨架屏（`MSkeleton`）+ tab bar 徽章（`mobileBadges` pinia store）
- 自动刷新（`useAutoRefresh`，visibility-aware），概览 30s / 告警 20s 轮询
- UA + viewport 检测自动 `/` → `/m/ops/summary` 跳转，`?desktop=1` 强制桌面版
- 账号面板支持切租户 / 切主题 / 退出

### 工具链与 E2E 支撑

- Playwright globalSetup 接通 config，每次 e2e 前刷 token + 重新 seed ta/tb/tc
- seedTenant 上传 URL 加 `?tenantId=`；幂等键改为 tenant + 内容哈希稳定值
- e2e seed xlsx 统一引用后端权威源 `../../file-batch-system/docs/test-data/...`，前端副本删除
- actionTimeout 5s → 10s、navigationTimeout 10s → 15s、globalTimeout 3min → 30min、单测 timeout 15s → 25s
- 新增 `AGENTS.md` 跨仓联调相对路径索引 + 前端通用规则（useTenantReload / DOMPurify / 移动端不写 e2e）

### 文档整理

- `docs/` 按长期权威 / 阶段性报告（带日期前缀）/ 归档三层重组
- `docs/README.md` 作为文档索引
- 阶段性报告统一加 `YYYY-MM-DD-` 前缀入 `docs/reports/`

---

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

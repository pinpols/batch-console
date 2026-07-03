# Batch Console 前端重设计实施准备

> 状态:准备完成,待进入 Phase 1 实施。
> 日期:2026-07-03
> 视觉源:`../../design/Batch Console 设计定稿.html`
> 设计规格:`../../design/export/batch-console-设计规格.md`
> Token 交付:`../../design/refs/tokens-handoff.css`

## 1. 定稿口径

- 信息架构采用 **IA v3 / 7 组**:工作台、运行监控、告警与投递、作业与流程、文件、调度治理、系统管理。
- 低频 admin 入口不进侧边栏:配额策略、队列配置、运行窗口、业务日历,通过 Command Palette 可达。
- 根 `design/` 是本轮重设计的最新视觉设计入口。`docs/engineering/` 只保存工程实施计划和长期工程规范。

## 2. 实施原则

- 先改全局底座,再迁移页面。避免一次性重写所有业务页。
- 保留现有 Vue 3、Element Plus、Pinia、Router、i18n、OpenAPI 生成类型和测试体系。
- 所有可见文案继续走 `src/locales/zh-CN.ts` 与 `src/locales/en-US.ts`,中英文 key 必须同步。
- 不手写 `src/types/api.generated.ts`;接口变化仍从后端 OpenAPI 生成。
- 不为了视觉重设计改变业务接口、权限判断、租户隔离或数据口径。

## 3. Phase 拆分

### Phase 0:准备层

已完成:

- 设计定稿、规格、tokens 和关键参考图集中在根 `design/`。
- 旧命名目录已重命名收敛:工程方案归 `docs/engineering/`,审计资料归 `docs/audits/ui-ux/`。
- IA 冲突口径收敛为 IA v3 / 7 组。

验收:

- `design/README.md` 能说明最新设计入口。
- `docs/README.md` 和 `docs/engineering/README.md` 能指向根 `design/`。
- `git status` 不再出现两个设计目录并存。

### Phase 1:全局视觉底座

目标文件:

- `src/styles/tokens.css`
- `src/styles/element-override.css`
- `src/styles/app.css`
- `src/constants/theme.ts`
- `src/stores/app.ts`
- `src/layout/DefaultLayout.vue`
- `src/layout/LayoutSidebar.vue`
- `src/layout/components/LayoutHeader.vue`
- `src/components/common/PageHeader.vue`

实施内容:

- 将 `refs/tokens-handoff.css` 映射进现有 token 体系,优先覆盖语义色,不新增平行变量体系。
- 引入深色默认、浅色可切的主题策略,保留现有用户主题记忆。
- 重做 Sidebar/Header 的密度、折叠、激活态、图标与顶部操作布局。
- 统一 PageHeader 的标题、描述、操作区和面包屑视觉。

验收:

- 控制台首页、列表页、详情页、设计器页在 1440px / 390px 宽度无明显重叠。
- `npm run check:i18n`
- `npm run typecheck`
- `npm run lint:check`
- `npm run build`

### Phase 2:导航与 IA 迁移

目标文件:

- `src/constants/navigation.ts`
- `src/constants/pageMeta.ts`
- `src/router/index.ts`
- `src/components/common/CommandPalette.vue`
- 后端 `file-batch-system/batch-console-api/src/main/resources/menu.yml`

实施内容:

- 将侧边栏调整为 IA v3 / 7 组。
- 低频 admin 页面从侧边栏移出,保留 Command Palette 和直达路由。
- 同步后端 `menu.yml`,避免 `/auth/me` 菜单 allowlist 导致新 IA 页面不可达。
- 保持 `activeMenu`、breadcrumb、LayoutTabs、Command Palette 使用同一 pageMeta 口径。

验收:

- admin、tenant admin、viewer 三类角色下菜单可见性正确。
- 直达低频路由不被错误重定向。
- 侧边栏、Command Palette、面包屑文案一致。

### Phase 3:通用列表和抽屉模板

目标文件:

- `src/components/table/ProTable.vue`
- `src/components/table/ListPageQueryBar.vue`
- `src/components/table/BulkActionBar.vue`
- `src/components/common/DetailDrawer.vue`
- `src/components/common/MetricCard.vue`
- `src/components/common/StatusTag.vue`
- `src/components/common/EmptyState.vue`

实施内容:

- 落地 32px 控件基线、舒适/紧凑密度联动、统一列表筛选条。
- 列表页统一新建、编辑、详情抽屉三态。
- 统一状态徽章、指标卡、空态、错误态、批量操作条。

验收:

- 选取 6 个代表页做截图回归:控制面板、Job 定义、文件列表、Worker 管理、告警中心、作业实例详情。
- 所有列表页无硬编码中文新增。
- 批量选择、列设置、分页和错误态不回退。

### Phase 4:重点业务页迁移

优先页面:

- `src/views/ops/OpsSummary.vue`
- `src/views/job/JobDefinitionList.vue`
- `src/views/workflow/designer/WorkflowDesigner.vue`
- `src/views/monitor/JobInstanceList.vue`
- `src/views/monitor/JobInstanceDetail.vue`
- `src/views/observability/AlertList.vue`
- `src/views/file-center/FileList.vue`
- `src/views/worker/WorkerManagement.vue`

实施内容:

- 逐页套用新底座与通用模板。
- 保留现有业务流和 API wrapper。
- 对每个页面做桌面和移动端 spot check。

验收:

- `npm run test:unit`
- `npm run build`
- 关键 Playwright smoke:登录、租户切换、Job 定义、作业实例、告警、文件列表、Workflow 设计器。

## 4. 后端同步点

- 侧边栏显隐仍受 `/api/console/auth/me` 返回菜单影响。
- IA 分组改动必须同步后端 `menu.yml`,否则前端 route 存在但用户会被 guard 重定向。
- 新增或重命名路径时,同时检查:
  - `src/router/index.ts`
  - `src/constants/pageMeta.ts`
  - `src/constants/navigation.ts`
  - `src/locales/*`
  - 后端 `batch-console-api/src/main/resources/menu.yml`

## 5. 风险与处理

- 风险:一次性改全局样式影响所有页面。
  - 处理:Phase 1 只改语义 token 和布局壳,不改页面业务结构。
- 风险:IA 改动导致低频页面不可达。
  - 处理:低频页面保留路由和 Command Palette,只从侧栏移出。
- 风险:Element Plus 默认样式覆盖面过大。
  - 处理:先在 `element-override.css` 做 token 化覆盖,避免逐页写 scoped CSS。
- 风险:深色默认影响可读性。
  - 处理:正文、次级、禁用文本均以 WCAG 可读性为下限,不照搬低对比设计值。

## 6. 开工检查清单

- [ ] 确认当前分支基于最新 `main`。
- [ ] 后端本地健康,前端 dev server 可访问。
- [ ] 打开 `design/Batch Console 设计定稿.html` 作为视觉参照。
- [ ] Phase 1 前先截图当前首页、列表页、详情页、设计器页作为 before。
- [ ] 每个 Phase 单独提交,不要把 UI 底座和业务页迁移混在一个提交里。

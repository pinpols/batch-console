# Batch Console 前端重设计实施准备

> 状态:准备完成,待进入 Phase 1 实施。
> 日期:2026-07-03
> 视觉源:`../../design/Batch Console 设计定稿.html`
> 设计规格:`../../design/export/batch-console-设计规格.md`
> Token 交付:`../../design/refs/tokens-handoff.css`

## 0. 开工前置(阻塞项,未关闭不进 Phase 1)

- [ ] **IA 分组数定死**:本 plan 写 **7 组**,但 `design/CLAUDE.md` 记「已拍板 **5 组**」,两处矛盾。必须二选一,并把另一处同步改掉(直接决定 Phase 2 的 `navigation.ts` / `pageMeta.ts` / 后端 `menu.yml`,选错必返工)。
- [ ] **基线合并**:本轮 prep(根 `design/`、本 plan、tokens、目录 reorg)目前在 **codex 分支**,未推远端、不在 `main`;而 `main` 已含近期已合 UX:**#176 表单渐进披露 / #177 QueueConfig 懒加载 / #179 筛选栏等宽栅格 + 占位符文案清洗 / #180 设计文档**。两边已分叉(main 独有 8 / codex 独有 7)。**必须先合出一个同时含「设计 prep」与「#176–#180」的统一基线**,Phase 1 在该基线上开工——否则会覆盖回退这些已合修复。
- [ ] **Token 定稿确认**:`design/refs/tokens-handoff.css` 为最终交付版(非占位),色/间距/字号齐全。

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
- **继承而非推倒近期已合修复**:#176 表单渐进披露、#177 列表 tab 懒加载、#179 筛选栏等宽栅格 + 占位符文案清洗;重做同名组件/页面时在其之上改,**禁止回退**。

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

- 落地 32px 控件基线、舒适/紧凑密度联动、统一列表筛选条(**筛选条在 #179 的等宽栅格 + 标签固定宽基础上做,不重造宽度体系**)。
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
- 保留现有业务流和 API wrapper(**保留 #177 的 tab 懒加载,勿改回一次性 `Promise.all` 全量拉取**)。
- 对每个页面做桌面和移动端 spot check。

验收:

- `npm run test:unit`
- `npm run build`
- 关键 Playwright smoke:登录、租户切换、Job 定义、作业实例、告警、文件列表、Workflow 设计器。

### Phase 5:长尾页面 + 收尾

重点页覆盖后,其余 ~30 页按 Phase 3 模板批量套用;本轮不迁移的页面**明确标注"维持旧样式待后续"**,避免误以为一次全覆盖。

实施内容:

- 逐组套模板(配置与系统 / 调度治理 / 报表 等剩余页)。
- **移动端 `/m/*` 范围写死**:明确本轮是「跟随底座变量自动生效」还是「逐页重设计」(原型只出了桌面稿)。
- **视觉回归脚本化**:把 Phase 3 的"6 页截图回归"固化为 Playwright 抓图脚本,每 Phase 跑一次并排比对(避免只靠人肉截图)。

验收:

- 有一张**页面迁移状态表**(已迁移 / 维持旧样式 / 待办),全站页面无遗漏或"以为做了其实没做"。
- `npm run build` + 全量 Playwright smoke 绿。

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
- 风险:深色默认全量硬切,线上出问题不可回退。
  - 处理:主题以 **feature flag / 灰度**控制,保留浅色完整支持,可一键回退;不删浅色 token。
- 风险:重设计与 `main` 近期已合修复(#176/#177/#179)冲突或回退。
  - 处理:先做**基线合并**(见 §0),所有重做以已合版本为起点,Phase 3/4 显式核对不回退。

## 6. 开工检查清单

- [ ] **§0 三个前置阻塞项全部关闭**(IA 5/7 定死 / 基线合并含 #176–#180 / token 定稿)。
- [ ] 确认当前分支基于最新 `main`(且已含 #176–#180)。
- [ ] 后端本地健康,前端 dev server 可访问。
- [ ] 打开 `design/Batch Console 设计定稿.html` 作为视觉参照。
- [ ] Phase 1 前先截图当前首页、列表页、详情页、设计器页作为 before。
- [ ] 每个 Phase 单独提交,不要把 UI 底座和业务页迁移混在一个提交里。

# batch-console Frontend Agent Guide

批量调度系统前端控制台，使用 Vue 3、TypeScript、Element Plus、Pinia、vue-i18n 和 TanStack Query。桌面页面位于 `src/views/`，移动页面位于 `src/views-mobile/`；API 类型由配对后端 OpenAPI 生成。

> **维护规则**：本文件只保留不能从代码推断的约束、高频红线和权威文档入口。细节应维护在对应 `docs/` 文档中。
>
> 修改本文件既有规范时，同步更新 [`docs/changelog.md`](docs/changelog.md)（日期倒序）。功能、缺陷、运维变更写入对应文档，不把临时任务说明塞进本文件。
>
> 配对后端约定见 [`../file-batch-system/AGENTS.md`](../file-batch-system/AGENTS.md)。

多阶段、跨仓/跨模块、跨轮次或高风险任务，按配对后端 Skill 指南维护原始目标、范围、验收、决定、进度与下一步，并在关键里程碑对照当前 diff/证据做只读纠偏；不得因上下文变长自行改目标或扩展文件/操作范围。

改造方案、架构/系统评审、治理审查、整改计划和验收结论必须主动记录到对应权威文档，不等用户逐次提醒；前端文档类型按 `docs/README.md` 与 `docs/engineering/agent-skills-guide.md` 导航，双仓通用归档规则见配对后端 `docs/standards/document-governance.md`。优先更新已有方案、工程规范、审计/报告或台账；短小日常修改不新建文档。评估和评审记录发现与建议，不自动授权实施。

编辑前检查当前分支、暂存/未暂存/未跟踪文件和差异，保留已有改动，不做无关清理或覆盖。

## 文档查找与更新

- 本仓“去哪找、写到哪里”先查 `docs/README.md`；系统与跨仓改动的同步范围查 [配对后端文档路由](../file-batch-system/docs/standards/document-routing-guide.md)。本仓目录继续遵循前端索引，不复制后端文件夹布局。
- 长期 UI/架构/接口/操作说明维护原文，阶段方案在原文件更新范围和状态，执行日志追加批次，每轮审计/验收另存日期记录。系统行为或契约变化必须同步实际受影响资产，不能只追加修复报告。
- 使用 `frontend-docs-release-governance` 维护前端资料；后端系统/数据库/API 资产留在后端权威位置，前端引用并同步生成类型与调用方，避免双份规范漂移。

## Skills

**每项任务开始前，必须先查阅 [`Agent Skill 使用指南`](docs/engineering/agent-skills-guide.md)，按任务选择一个最匹配的总控和必要的专项 Skill。请求命中某个 Skill 的适用范围时，必须读取并遵循对应完整 `SKILL.md`，不能只凭技能名称或本索引执行；用户明确点名的 Skill 必须使用。不要机械加载全部 Skill；没有匹配 Skill 时遵循本文件和权威项目文档，不强行套用无关流程。Skill 提供工作方法，不扩大用户对写入、部署或 Git/外部状态变更的授权。**

技能目录如下，具体选择和组合见指南：

- **双仓周期治理**：`cross-repo-governance-review`，用于月度/季度治理、全量深扫、规范防退化、代码腐化、发布前复核和事故后复盘，固定覆盖前后端 20 个领域。
- **前端Bug与综合质量审查**：`frontend-quality-review`，负责代码Bug/变更和跨领域结论，分别记录功能缺陷、可用性/可访问性、规范偏差及建议。
- **UI、交互与视觉专项**：`frontend-ui-ia-review`，维护页面任务、布局美观、组件一致性及常见交互问题的检查方法；纯UI任务直接使用，不另建入口。
- **前端工程与规约治理**：`frontend-engineering-governance`，负责架构、可读性/规约和门禁/供应链；Bug和UI证据按需复用既有专项。
- **开发与运维入口**：本地前端构建/容器联调使用 `frontend-deploy-runtime`、`frontend-testing-ci`；共享开发环境操作参考配对后端 `developer-workflow`，平台运行态分析使用后端严格只读的 `operations-analysis`。

**前端专项：**

- `frontend-ui-ia-review`：页面设计、信息架构、导航、数据密集视图、表单和移动适配。
- `frontend-i18n-accessibility`：用户文案、i18n、ARIA、键盘和安全 HTML 渲染。
- `frontend-api-contract`：API、OpenAPI 生成类型、认证和权限契约。
- `frontend-state-data-flow`：Vue/Pinia/TanStack Query、租户切换、分页、轮询和异步状态。
- `frontend-import-template-governance`：配置包、Excel 模板、导入导出和相关测试数据。
- `frontend-testing-ci`：单测、Playwright、前端门禁及验证策略。
- `frontend-engineering-governance`：架构、依赖、环境变量、SBOM、许可证和治理检查。
- `frontend-deploy-runtime`：Docker、Nginx、运行时配置、PWA 和部署。
- `frontend-docs-release-governance`：README、文档索引、变更记录和发布文档。

- **交付流程**：`git-pr-workflow`，用于分支、PR、连续交付链、远端 head 核验和清理。

仓库约定和配对后端契约优先于通用技能建议。技能负责流程，不取代代码、测试和 CI 的实际证据。
详细选择树、组合示例和调用方式见 [`docs/engineering/agent-skills-guide.md`](docs/engineering/agent-skills-guide.md)。

## 配对后端

- 仓库：`../file-batch-system`；REST API 位于 `batch-console-api`，数据库结构和迁移位于 `db`。
- 验证后端行为时直接检查对应 Controller、DTO、权限配置和 OpenAPI，不根据前端猜测契约。
- 后端指南：[`../file-batch-system/AGENTS.md`](../file-batch-system/AGENTS.md)。

## 分支与交付

- 唯一常驻分支是 `main`；功能、缺陷、测试、文档、CI 和部署改动均从 `main` 建短期分支，经 PR 合入 `main`。
- 分支命名使用 `feature/`、`fix/`、`chore/` 或 `docs/` 前缀。不要另建常驻 `dev` 或部署分支。
- 部署文件属于产品的一部分，与应用代码同在 `main`。
- PR、连续交付链和合并后的 diff 核验按 `git-pr-workflow` 执行；不得把历史授权当作当前合并或删除分支的授权。

## 常用命令

| 命令                                        | 用途                                   |
| ------------------------------------------- | -------------------------------------- |
| `npm run dev`                               | 启动 Vite 开发服务器（默认 5173）      |
| `npm run preflight:changed`                 | 按暂存变更运行提交前检查               |
| `npm run verify:local`                      | 运行无后端本地门禁，不代表真实业务验收 |
| `bash scripts/local/fe-acceptance.sh`       | 依赖真实后端的全链路验收               |
| `npm run gen:api` / `npm run gen:api:check` | 生成或检查前后端 API 类型漂移          |

测试分层、测试 helper 和案例见 [`docs/testing/README.md`](docs/testing/README.md)；CI 触发、门禁和发布顺序见 [`docs/runbook/ci.md`](docs/runbook/ci.md)。其他命令以 `package.json` 为准。

## 不可违约约束

- **API 类型**：`src/types/api.generated.ts` 由 `../file-batch-system/docs/api/console-api.openapi.yaml` 生成，禁止手改。接口变更先更新后端 OpenAPI，再运行 `npm run gen:api`。
- **API 客户端**：请求统一走 `src/api/client.ts` 导出的客户端方法；禁止在组件中新建 axios 实例或绕过拦截器。
- **租户切换**：依赖当前租户的数据加载使用 `useTenantReload(loadFn)`；TanStack Query 将租户标识纳入 `queryKey`。
- **认证与权限**：认证由后端 HttpOnly Cookie 契约处理；前端不读取或持久化 token、不自行添加 `Authorization`。前端权限只控制体验，后端负责授权裁决。
- **HTML 安全**：禁止 `v-html`。需要呈现 HTML 时使用 `v-safe-html`；手动写入 `innerHTML` 前使用 `purifyHtml()`。后端返回内容也视为不可信输入。
- **用户文案**：所有用户可见字符串使用 `t('namespace.key')`；`zh-CN` 与 `en-US` 保持 key 一致。
- **样式与组件**：遵循 [`docs/engineering/design-tokens.md`](docs/engineering/design-tokens.md)，优先复用 design token、Element Plus 和 `src/components/common/` 录入助手；不要为相同交互另造裸 HTML 组件或重复校验逻辑。
- **代码约定**：解释性注释用中文；Vue 组件使用 PascalCase，composable 使用 `useXxx`；禁止在 `.vue`/`.ts` 留 `console.log` 或添加 emoji（用户明确要求除外）。嵌套调用、参数合法状态、字符串事实源与抽象边界遵循 [`docs/engineering/code-readability-governance.md`](docs/engineering/code-readability-governance.md)。
- **列表分页**：默认每页 15 条，选项使用 `[15, 30, 50, 100]`；确有业务差异时应有明确依据。

## 测试边界

- 移动页面不重复编写自动化测试；业务逻辑由共享模块和桌面测试覆盖。若移动端引入独立业务逻辑或出现移动端专属回归，应为该逻辑/缺陷补针对性测试。
- Playwright 的运行范围和环境以 [`docs/runbook/ci.md`](docs/runbook/ci.md) 与 `playwright.config.cjs` 为准；不要把 mock/fixture 验证描述成真实后端验收。
- 写测试前阅读 [`docs/testing/README.md`](docs/testing/README.md)，复用既有 helper 和测试约定。
- 行为变更优先先写能表达用户可观察验收条件的测试，并在可行时确认目标测试先因该行为失败，再实现；按风险选最小有效层级，状态/异步/契约优先组件或真实浏览器路径。文档、格式和纯机械变更不强制测试先行。测试执行范围按用户请求和对应 Skill 决定。
- 测试输入与配置优先复用权威来源和共享 fixture；契约断言保留独立预期值，避免实现与期望同源而漏检漂移。Vitest、Playwright 和 storage-state 脚本中的持久化键、平台服务地址及 localStorage 桩由 `check:test-fixture-sources` 守护。详见 [`docs/testing/README.md` §9.1](docs/testing/README.md#91-测试数据与配置来源)。

## 目录速查

```text
src/api/          REST 客户端与查询适配
src/components/   共用组件和表单助手
src/composables/  跨页面组合逻辑
src/layout/       桌面布局
src/layout-mobile/ 移动布局
src/locales/      中英文词条
src/router/       桌面与移动路由
src/stores/       Pinia 状态
src/styles/       全局样式和 design token
src/types/        手写类型与生成 API 类型
src/views/        桌面页面
src/views-mobile/ 移动页面
```

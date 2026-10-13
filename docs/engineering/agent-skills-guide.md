# 前端 Agent Skill 使用指南

本指南说明在 `batch-console` 与配对后端 `file-batch-system` 中如何选择、组合和验收 Agent Skill。它是使用入口，不重复各 `SKILL.md` 的执行细节；实际规则仍以仓库代码、契约、CI、`AGENTS.md` 和对应 Skill 为准。

## 选择顺序

先判断任务层级，再选择技能：

1. 前后端周期治理、全量深扫、规范防退化或代码腐化盘点：使用 [`cross-repo-governance-review`](../../.agents/skills/cross-repo-governance-review/SKILL.md)。
2. 单次前端跨领域审查：使用 [`frontend-quality-review`](../../.agents/skills/frontend-quality-review/SKILL.md)。
3. 已明确的单点实现或审查：直接使用对应专项 Skill。
4. 分支、提交、PR、合并或清理：额外使用 [`git-pr-workflow`](../../.agents/skills/git-pr-workflow/SKILL.md)。交付授权不会由审查或实现任务自动产生。

不要为了“更全面”在每个小改动中加载全部技能。总控 Skill 负责保证覆盖面，专项 Skill 负责具体判断和验证。

## 快速路由

| 任务 | 首选 Skill | 常见组合 |
|---|---|---|
| 月度/季度前后端治理、首次全量基线 | `cross-repo-governance-review` | 按其 20 域矩阵加载前后端专项 Skill |
| 全站 UI、交互、可读性和浏览器安全审查 | `frontend-quality-review` | `frontend-ui-ia-review`、`frontend-i18n-accessibility` |
| 页面结构、表格、表单、导航、移动适配 | `frontend-ui-ia-review` | 需要真实浏览器时结合 Playwright 验收 |
| 文案、i18n、ARIA、键盘、安全 HTML | `frontend-i18n-accessibility` | 涉及页面结构时组合 UI Skill |
| Console API、OpenAPI、认证和权限 | `frontend-api-contract` | 后端 `frontend-backend-contract` |
| 租户切换、查询缓存、分页、轮询、SSE | `frontend-state-data-flow` | `frontend-testing-ci` |
| Excel、配置包、导入导出模板 | `frontend-import-template-governance` | 后端 schema、OpenAPI 与真实 fixture |
| Vitest、Playwright、API drift、CI 门禁 | `frontend-testing-ci` | `frontend-engineering-governance` |
| 架构、依赖、可维护性、SBOM、workflow | `frontend-engineering-governance` | 跨仓周期复核使用总控 Skill |
| Docker、Nginx、环境变量、PWA、制品 | `frontend-deploy-runtime` | 发布前组合测试与治理 Skill |
| README、索引、Changelog、发布文档 | `frontend-docs-release-governance` | 文档变化后运行文档守卫 |
| 创建或更新 PR | `git-pr-workflow` | 先完成适用实现、审查和验证 Skill |

## 前后端周期治理的调用方式

`cross-repo-governance-review` 提供五种模式：月度增量、季度存量、发布前、事故后和首次全量基线。它固定检查产品旅程、批量领域、Worker/SDK、API、文件完整性、前端状态、数据库、架构、代码健康、安全、配置、测试、CI、静态分析、UI、容量成本、可观测性、灾备运维、文档发布及治理系统本身。

可直接提出：

- `用 $cross-repo-governance-review 做前后端首次全量治理基线`
- `用 $cross-repo-governance-review 做本月增量治理`
- `用 $cross-repo-governance-review 做季度代码腐化和规范退化复核`
- `用 $cross-repo-governance-review 做发布前治理审查`
- `用 $cross-repo-governance-review 复盘事故并补防复发守卫`

每次必须逐项给出已审查、不适用、未验证或明确排除，不能用静态扫描、历史报告或局部 CI 绿灯代替完整结论。配对后端的 Skill 指南见 [`file-batch-system/docs/standards/agent-skills-guide.md`](../../../file-batch-system/docs/standards/agent-skills-guide.md)。

## 组合示例

### 修改 Console API

1. 后端 Controller、DTO 和 OpenAPI 使用后端 `frontend-backend-contract`。
2. 前端生成类型、API 客户端和页面调用使用 `frontend-api-contract`。
3. 状态和缓存变化再加载 `frontend-state-data-flow`。
4. 测试和 API drift 使用 `frontend-testing-ci`。
5. 创建 PR 时使用 `git-pr-workflow`，两仓分别提交，不把一仓通过外推为另一仓通过。

### 审查复杂页面

以 `frontend-quality-review` 为总控；信息架构和密度进入 `frontend-ui-ia-review`，文案/键盘/ARIA 进入 `frontend-i18n-accessibility`，请求竞争和租户状态进入 `frontend-state-data-flow`，浏览器验证进入 `frontend-testing-ci`。审查只报告发现；用户要求修复后才修改实现。

### 新增治理门禁

使用 `frontend-engineering-governance`。先证明一个应拦案例和一个相似但应放行案例，再决定阻断、报告、增量或人工周期复核。同步脚本登记、workflow 触发、CI 文档和 Changelog；不要用扩大基线或宽泛例外换取绿色。

## 证据与交付边界

- 当前后端 Controller/OpenAPI 高于前端猜测；生成类型禁止手改。
- 真实后端验收、mock/fixture、静态检查和构建是不同证据层级。
- `PASS`、`FAIL`、`SKIP`、报告型结果和未运行必须分开。
- 单次抽样无发现不代表所有页面、角色、租户、状态和浏览器均已验收。
- Skill 负责工作流，不自动授权提交、推送、创建 PR、合并、清理或创建定时任务。

## 维护规则

- 新增、删除或重新定位 Skill 时，同步 `AGENTS.md`、本指南和对应索引。
- 通用选择规则写在本指南；具体执行细节只维护在相应 `SKILL.md`，避免两套规则漂移。
- 机器可判断且低误报的约束进入可测试门禁；业务语义、抽象适度和真实环境能力保留人工/AI 周期审查。
- 不在长期指南中固化测试数量、告警数量、耗时或某次 PR 状态。

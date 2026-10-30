# 前端 Agent Skill 使用指南

本指南说明在 `batch-console` 与配对后端 `file-batch-system` 中如何选择、组合和验收 Agent Skill。它是使用入口，不重复各 `SKILL.md` 的执行细节；实际规则仍以仓库代码、契约、CI、`AGENTS.md` 和对应 Skill 为准。

Skill 的英文 `name` 和目录名用于 `$skill` 调用；配置了 `agents/openai.yaml` 的技能由该文件维护中文界面显示名与短说明。中文自然语言可用于描述任务，显示名不是命令别名，实际元数据以当前文件为准。

本仓现行技能统一维护 `agents/openai.yaml` 的中文显示名和短说明；`default_prompt` 是可选的调用起始提示，不替代用户任务或授权。任务匹配依据 `SKILL.md` 的 `description`；缺少显式调用策略时保持默认自动匹配，不为补界面元数据增加禁用策略或工具依赖。个人偏好不复制进各个技能。

`references/` 只在存在条件化详细方法时设置，并由入口说明何时读取。短技能可直接引用现有权威文档，不创建空目录或复制手册。运行进度真实验收按需加载[测试方法参考](../../.agents/skills/frontend-testing-ci/references/runtime-progress-acceptance.md)，普通单测或门禁任务不预读整份场景方法。整理记录见[元数据与参考资料复核](../reports/2026-10-26-skill-metadata-and-references.md)。

## 选择顺序

先判断任务层级，再选择技能：

1. 明确前后端双仓的周期/全域治理、规范防退化或代码腐化盘点：使用 [`cross-repo-governance-review`](../../.agents/skills/cross-repo-governance-review/SKILL.md)；仅前端任务按下面入口选择。
2. 前端代码Bug/普通变更或跨领域综合质量：使用 [`frontend-quality-review`](../../.agents/skills/frontend-quality-review/SKILL.md)，按Bug专项或综合审查取证。
3. 仅UI、交互、美观与视觉一致性：使用 [`frontend-ui-ia-review`](../../.agents/skills/frontend-ui-ia-review/SKILL.md)及其[常见问题表](../../.agents/skills/frontend-ui-ia-review/references/common-ui-checks.md)。
4. 前端架构、全量规约、可读性或门禁治理：使用 [`frontend-engineering-governance`](../../.agents/skills/frontend-engineering-governance/SKILL.md)。
5. 明确的API、状态、i18n、测试等单点任务直接使用对应专项；共享同基线证据，不要求多个入口重复执行。
6. 分支、提交、PR、合并或清理：额外使用 [`git-pr-workflow`](../../.agents/skills/git-pr-workflow/SKILL.md)。交付授权不会由审查或实现任务自动产生。

不要为了“更全面”在每个小改动中加载全部技能。总控 Skill 负责保证覆盖面，专项 Skill 负责具体判断和验证。

## 统一任务理解与执行协议

前后端 Skill 共用后端 [`统一任务理解与执行协议`](../../../file-batch-system/docs/standards/agent-skills-guide.md#统一任务理解与执行协议)，本指南只补充前端路由。先分清用户要的是评估/审查、整改/实施、验证/验收还是交付；可组合多个阶段，但按依赖顺序完成。审查默认只读，实施允许工作区改动，验证允许相关本地检查；部署、环境写入、迁移、数据清理、压测、故障注入以及提交、推送、创建 PR、合并、关闭 Issue、删除分支均按具体动作单独判断授权。

前端本地开发、构建和 Docker/Compose 联调用 `frontend-deploy-runtime` 与 `frontend-testing-ci`；共享后端服务或整套本地环境的操作方式遵循配对后端 [`developer-workflow`](../../../file-batch-system/.agents/skills/developer-workflow/SKILL.md)。平台运维只读分析使用后端 [`operations-analysis`](../../../file-batch-system/.agents/skills/operations-analysis/SKILL.md)。不因加载总控或专项 Skill 而扩大用户请求的动作范围。

测试类任务按仓库区分：前端 Vitest/Playwright 与前端门禁用 `frontend-testing-ci`；后端 Java 测试类、fixture、测试分层用配对后端 [`backend-testing-governance`](../../../file-batch-system/.agents/skills/backend-testing-governance/SKILL.md)。两者的测试执行验收和 CI 门禁仍分别按各自验收/CI 流程处理。

改造方案、架构/系统评审、治理审查、整改计划和验收结论必须主动更新到对应权威文档，不等用户逐次提醒。优先更新现有 `docs/engineering/` 或 `docs/architecture/` 方案、匹配的 Backlog 主记录、`docs/audits/` 审计材料、`docs/reports/` 阶段报告或 `docs/runbook/`；目录与记录类型遵循 [`frontend-docs-release-governance`](../../.agents/skills/frontend-docs-release-governance/SKILL.md)。短小日常修改不新建文档；评估和评审记录发现与建议，不自动授权实施。

### 开发环境与只读运维分析

- 前端本地安装/构建、Docker/Nginx/PWA 使用 `frontend-deploy-runtime`；测试与门禁使用 `frontend-testing-ci`。涉及配对后端、共享服务或全栈 Compose 时，组合后端 `developer-workflow`，先按双方 Runbook 核对服务、端口、数据和配置归属。
- 只分析前端部署、日志、浏览器错误或观测数据时，使用 `frontend-deploy-runtime` 并遵守只读边界；涉及共享平台、后端调度、Worker、数据库或恢复链路时，使用后端只读 [`operations-analysis`](../../../file-batch-system/.agents/skills/operations-analysis/SKILL.md)。分析 Skill 不授权部署、启停、迁移、写入、清理、压测或故障注入。
- 示例：`用 $frontend-deploy-runtime 检查当前 Docker/Nginx 配置和日志，做只读分析；不要改配置或重启服务。`；`用 $developer-workflow 检查前后端本地 Compose 联调，先映射服务与验证步骤，不执行清库或删除 volume。`

## 快速路由

| 任务 | 首选 Skill | 常见组合 |
|---|---|---|
| 月度/季度前后端治理、首次全量基线 | `cross-repo-governance-review` | 按其 20 域矩阵加载前后端专项 Skill |
| 前端代码Bug、变更或跨领域综合审查 | `frontend-quality-review` | 按实际范围复用UI/状态/API等专项；Bug、规范和视觉建议分别记录 |
| 全站 UI、交互、美观与视觉一致性 | `frontend-ui-ia-review` | 具体检查表统一维护；文案/DOM语义按需组合i18n专项，业务Bug交质量审查 |
| 页面结构、表格、表单、导航、移动适配 | `frontend-ui-ia-review` | 需要真实浏览器时结合 Playwright 验收 |
| 文案、i18n、ARIA、键盘、安全 HTML | `frontend-i18n-accessibility` | 涉及页面结构时组合 UI Skill |
| Console API、OpenAPI、认证和权限 | `frontend-api-contract` | 后端 `frontend-backend-contract` |
| 租户切换、查询缓存、分页、轮询、SSE | `frontend-state-data-flow` | `frontend-testing-ci` |
| Excel、配置包、导入导出模板 | `frontend-import-template-governance` | 后端 schema、OpenAPI 与真实 fixture |
| Vitest、Playwright、API drift、CI 门禁 | `frontend-testing-ci` | `frontend-engineering-governance` |
| 前端架构、规约/可读性、依赖、SBOM、workflow | `frontend-engineering-governance` | 维护语义规约与守卫，明确双仓周期任务再使用双仓总控 |
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

## 文档与脚本全量治理

仅做文档和脚本治理时，使用 `frontend-docs-release-governance` 统筹分类、命名、归档与索引，再按[脚本与 Skill 路由](script-skill-routing.md)组合工程、测试、契约、导入或部署 Skill；不因此扩展为双仓全部领域审查。全量结论须给出当前 Git 文件集与逐文件覆盖证据，包含未跟踪来源、中文文件名、SQL、PowerShell 和无扩展名 hooks。静态复核、针对性检查与真实运行验收分别记录。

## 维护规则

- 新增、删除或重新定位 Skill 时，同步 `AGENTS.md`、本指南和对应索引。
- 通用选择规则写在本指南；具体执行细节只维护在相应 `SKILL.md`，避免两套规则漂移。
- 机器可判断且低误报的约束进入可测试门禁；业务语义、抽象适度和真实环境能力保留人工/AI 周期审查。
- 不在长期指南中固化测试数量、告警数量、耗时或某次 PR 状态。

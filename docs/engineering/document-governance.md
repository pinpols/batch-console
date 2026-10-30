# 前端文档治理

本文维护 `batch-console` 文档的职责边界、日期命名、归档和检查路由。系统级跨仓记录先按配对后端的[文档路由](../../../file-batch-system/docs/standards/document-routing-guide.md)定位权威资产；通用生命周期规则参考其[文档治理规范](../../../file-batch-system/docs/standards/document-governance.md)，前端目录仍以本仓 `docs/README.md` 为准。

## 文档分类

| 类型 | 维护位置 | 处理方式 |
|---|---|---|
| 当前 UI、架构、API、测试方法与运维手册 | `docs/engineering/`、`docs/architecture/`、`docs/api/`、`docs/testing/`、`docs/runbook/`、`docs/user-guide/` | 稳定文件名，更新唯一现行文本；API 契约仍以后端 OpenAPI 为准。 |
| 未闭环的功能或真实环境验收 | 现有 `docs/backlog/` 或主实施方案 | 保留明确的负责人边界、验收条件、证据和下一步；实现完成但外部验收未完成时只归档已完成部分。 |
| 一次性审查、复现、实施或验收记录 | `docs/reports/`、`docs/audits/` | 保留来源日期、代码基线、范围、证据和限制；报告说明历史结论，不代替当前设计或待办。 |
| 已过时的环境快照、关闭清单、旧方案和代码量快照 | `docs/archive/` | 保留原始结论并说明适用时点；不得作为当前缺陷、运行步骤、规模趋势或验收结论。 |

## 日期与文件名

- 持续维护的规则、设计、索引和 Runbook 用稳定名称，不随复核日期改名。
- 阶段方案在正文记录原始基线日期和当前状态；需要补文件名后缀时使用原始完整日期。长期资产中的扫描计数、批次日志提取到日期记录，仍保留原始证据与反向链接。
- 新的一次性报告遵循 `docs/README.md` 的日期前缀规则 `YYYY-MM-DD-topic.md`；历史报告保留原名，只有在职责迁移或歧义明显时才补充可由 Git/正文核实的日期。
- 阶段计划的推进日期写在正文或执行日志；代码量快照保留统计基线日期。归档日不能冒充报告日期，口径不同的 LOC 数字不能直接连成趋势。
- 移动或改名时同步当前索引、归档索引、代码/脚本/Skill 引用和统一文档站排除规则；只修路径或历史适用性说明，不重写旧结论。

## Skill 与脚本路由

| 工作 | Skill | 权威检查入口 |
|---|---|---|
| 文档分类、内容更新、日期命名、索引和归档 | `frontend-docs-release-governance` | `npm run check:docs`、`npm run check:changelog` |
| 守卫范围、package script、文档站体积和治理基线 | `frontend-engineering-governance` | `scripts/check-docs.mjs`、`scripts/check-changelog-sync.mjs`、`scripts/check-go-live-readiness-doc.mjs`、`scripts/check-docs-bundle-size.mjs` |
| 文档门禁的 Workflow/CI 触发或执行分层 | `frontend-testing-ci` | `docs/runbook/ci.md` 与 `.github/workflows/` |
| OpenAPI、生成类型或前后端接口说明 | `frontend-api-contract` | 后端 OpenAPI、Controller 与 `npm run gen:api:check` |

文档和脚本的完整盘点、角色分类及执行边界见[脚本与 Skill 路由](script-skill-routing.md)。归档脚本仍计入全量来源，标记历史状态；无扩展名 hooks、PowerShell、SQL fixture 和执行声明不能被扩展名筛选漏掉。

文档正文的事实来源优先于 Skill 摘要。只因检查脚本存在，不代表所有页面都已人工审阅；技能提炼记录通用决策和复验边界，不复制规范全文，也不新增与既有职责重复的技能。

## 验证

- 当前文档或索引变化运行 `npm run check:docs`；治理规则与 `docs/changelog.md` 变化运行 `npm run check:changelog`。
- 更新上线准入或成熟度入口时运行 `npm run check:go-live-readiness`。
- 只有统一文档站页面、导航或发布输入变化时运行 `npm run docs:build`；该构建包含独立的 `DOCS_BUNDLE_SIZE` 预算门禁。

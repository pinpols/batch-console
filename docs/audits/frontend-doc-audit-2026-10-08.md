# 前端文档逐项审查（2026-10-08）

## 结论

本轮对 `docs/` 下 129 份 Markdown 文档逐项扫描目录归属、索引/本地链接、状态词、旧路径和当前入口，并复核现行操作手册、工程方案、测试/CI、设计来源、backlog 与主要日期化证据。发现的主要问题是完成事项仍挂在 backlog、关闭的 QA campaign 仍占据 runbook/qa 入口、旧视觉稿被称作当前设计来源，以及一份旧 patch 说明仍指导手动应用。已调整归属与入口，没有把环境验收缺口改写成完成。

## 逐项审查范围与结论

| 文档域 / 文件 | 结论与处理 |
|---|---|
| `docs/README.md` | 清理索引顶部游离条目；视觉设计指向根 `design/`；把真实环境验收与 Compose CD 路线放到明确的待办/规划入口；补充报告与归档规则。 |
| `design/README.md` | 新增设计资料索引；列明设计规格、token 和原型文件的权威顺序，避免引用不存在的 README。 |
| `docs/engineering/README.md`、`docs/runbook/README.md`、`docs/qa/README.md`、`docs/audits/README.md` | 清掉已移动材料的旧索引；停止把关闭的 C/D campaign 和历史密码方案放在当前运维入口；补齐现行入口。 |
| `docs/engineering/内嵌文档中心方案.md` | 已被统一 VitePress 文档站取代，移入 `docs/archive/early-proposals/`。 |
| `docs/design/redesign-2026-07-03/`、`docs/redesign/` | 旧稿仍自称权威，与根 `design/` 冲突；原型、截图、覆盖矩阵和旧实施计划集中归档到 `docs/archive/redesign-2026-07/`，审计报告明确其仅为历史依据。 |
| `docs/runbook/fe-qa-{c,d}-tier-{plan,report}.md`、`fe-be-joint-test-*`、`qa-c-baseline.md`、`docs/qa/d-tier/` | 已完成的 2026-05 campaign 中仍有未勾选的旧计划项，容易被误读为当前缺口；连同原始输出和补丁移入 `docs/archive/qa-2026-05/`。当前测试入口保留在 `docs/testing/` 和 CI runbook。 |
| `docs/qa/d-tier/be-patches/README.md` | 旧说明声称补丁待应用；补丁保留但增加禁止直接应用提示，要求先核实配对后端当前代码。 |
| `docs/runbook/password-security-backlog.md` | 正文已标为历史但仍在 runbook 且包含过期的“完全不支持/全部待实施”表格；移入 `docs/archive/security/`，保留当时决策证据。 |
| `docs/backlog/fe-acceptance-2026-08-{28,31}.md`、`fe-acceptance-2026-09-01.md` | 均为日期化测试快照，不是未完成开发任务；移入 `docs/reports/acceptance/`，保留当日 PASS/SKIP 数字及其时间边界。 |
| `docs/backlog/frontend-page-polish-2026-09-26.md` | FE-POLISH 已完成，但仍作为 backlog 展示；改归阶段报告 `docs/reports/frontend-page-polish-2026-09-27.md`，保留“尚未完成全场景真实验收”的限制。 |
| `docs/backlog/client-side-aggregation-pagination.md` | P1/P2 迁移已完成，正文却仍有“待迁移”旧动作；改归 `docs/reports/client-side-aggregation-pagination-2026-10-01.md`，保留剩余低基数字典/有界子资源边界。 |
| `docs/backlog/bulk-user-provisioning.md` | 功能与自动化已交付，仅真实 PG/Redis 并发、审计检索和安全审计未验收；保留 backlog，改名为环境验收并明确不代表已跑真实环境。 |
| `docs/backlog/ai-and-usage-statistics-todo-2026-09-29.md` | 保留；真实 provider 限流/超时、生产数据对账、真实租户切换和设备验收仍有明确外部证据缺口，不应归档成完成。 |
| `docs/runbook/compose-cd-roadmap.md` | 保留为未实施路线图；文档已有现状与目标链路区分，索引增加“规划中，不代表当前部署能力”的提示。 |
| `docs/architecture/project-structure.md`、工程 V3 方案及 2026-09-27 UI 审计 | 修正目录结构、当前设计来源和对已归档覆盖矩阵的历史属性。 |
| 工程 V3 方案的告警路由 Excel 行 | 与配对后端当前 OpenAPI 实际 path 交叉核对；目前仅有告警路由 CRUD path，没有 Excel path，改为明确不提供伪模板/占位入口。 |
| 其余现行 API、用户指南、工程规范、部署、测试、CI、合规、统计与验证材料 | 纳入全量索引/链接和过期状态扫描；保持原位。历史报告中的指标按报告日期保留，不回写成当前数据。 |

## 归档规则

- `backlog/` 只放尚未完成、且有明确验收条件的工作或环境验收。
- 一次性验收和已完成实施过程移到 `reports/`；失效方案和关闭 campaign 移到 `archive/`。
- 当前行为以源代码、OpenAPI、package scripts、workflow 和现行 runbook 为准；历史原始输出不作为当前通过证据。
- 常规 Markdown 修改仅跑快速文档与准入检查；完整 VitePress 文档构建仍由 CI 执行，本地不因普通文案/索引改动重复重建。

## 验证

| 检查 | 结果 |
|---|---|
| `npm run check:docs` | 通过；检查 70 份现行文档的链接与个人绝对路径 |
| `npm run check:go-live-readiness` | 通过；本轮起初误输 `check:go-live`，该次未计入结果，随后使用实际脚本名重新通过 |
| `npm run check:changelog` | 通过 |
| 全量 Markdown 本地链接扫描 | 通过；扫描 `docs/` 下 129 份文档，0 个失效链接；归档中的旧源码绝对路径改为纯文本证据 |
| `npm run docs:build` | 通过；因本轮调整 `.docsignore` 排除规则，额外本地构建确认文档站正常生成 |

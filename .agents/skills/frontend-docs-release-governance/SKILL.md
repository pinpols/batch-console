---
name: frontend-docs-release-governance
description: 整理前端 README、CLAUDE、docs 索引、Changelog、归档、运行手册、代码行/验收报告和发布说明时使用。重点避免文档漂移和过期入口。
---

# 前端文档与发布治理

## 文档路由与更新方式

- 前端归属按本仓 `docs/README.md`；系统变更的跨端同步范围读取配对后端 `../file-batch-system/docs/standards/document-routing-guide.md`，日期和归档只引用其文档治理规范，不在多个入口复制规则。
- 分别判断长期/阶段性与原文维护/增量记录：长期 UI、架构、接口和操作资产维护原文；阶段方案/矩阵更新状态；执行日志追加批次；每轮审查和验收另存日期记录。
- 从实际变更追踪工程、交互/使用说明、API 调用、配置/部署、测试方法和后端契约的受影响资产；只更新实际影响，不用新报告代替原资产更新。

## 方案、评审与治理留档

- 改造方案、架构/系统评估、代码或项目治理审查、整改计划和验收结论必须主动写入对应权威文档，不等用户逐次提醒；先查找并更新已有主记录。
- 前端长期架构/工程方案放 `docs/engineering/` 或 `docs/architecture/`，并登记 `docs/engineering/README.md` 与必要的 `docs/README.md`；UI/UX 审计证据放 `docs/audits/`，综合评估或一次性实施/验收报告放 `docs/reports/`，当前问题和阶段计划更新到对应现有方案/Backlog 主记录，操作规程放 `docs/runbook/`。本仓库没有单一通用 TODO 总表，不要另建重复台账。
- 记录日期、代码基线、范围、证据、决定、风险、优先级、未验证项和下一步；区分方案目标与已交付实现。跨轮次主计划更新进度和验收；简单日常任务不新建文档。
- 评估和审查只记录发现与建议，不自动扩大为实施授权。规范或文档体系变化同步 `docs/changelog.md`；用户可见功能与产品变化按根 `CHANGELOG.md` 规则记录。Changelog 不替代方案或评审正文。

## 文档分层

- `AGENTS.md` 只放不能从代码推断的约束、高频红线和关键入口；细节进入 `docs/`。
- 根 `README.md` 要说明项目用途、架构、启动、验证、部署和配对后端关系。
- `docs/README.md` 与子目录 README 负责索引当前长期文档；一次性验收、审计、压测和历史计划应进入 reports/backlog/archive 等合适目录。
- 当前文档由 `npm run check:docs` 检查链接和个人绝对路径；归档、报告和历史验证不作为现行规范扫描对象。

## Changelog 与归档

- 用户可见功能、交互变化、部署变化、安全修复和外部契约变化更新根 `CHANGELOG.md`。
- 修改 agent 规范、文档体系或长期治理规则时同步 `docs/changelog.md`。
- 带日期文件适合验收报告、审计报告、历史计划和一次性记录；长期规范、运行手册和索引通常不在文件名带日期。

## 漂移检查

- 文档中的命令、路径、端口、环境变量和 workflow 名称要跟 `package.json`、脚本、CI 和实际目录一致。
- 删除或移动文档时同步索引和引用，避免 README 指向不存在页面。
- 对“已验证”“已全绿”“已上线”等结论保留证据；没有当前证据时写成历史记录或待验证。
- 不在长期规范中固化测试数、页面数、耗时等易漂移快照；需要记录时放入带日期的验收或审计报告。
- 修改当前文档后运行 `npm run check:docs`；治理规则变化或维护本 Skill 时运行 `npm run check:changelog`；更新上线准入文档时运行 `npm run check:go-live-readiness`。
- 统一文档站页面、导航或发布输入变化时运行 `npm run docs:build`，并核对构建包含的文档体积预算结果；纯归档搬迁不因此运行完整站点构建。
- 超长证据超限时只处理生成发布副本，保留权威原文、字节摘要、完整块、行范围和原章节锚点；不能安全拆开时失败，不截断证据或放宽预算。使用 `test:docs-publication` 复核完整性，再在最新预览实际点击旧锚点、末卷、前后卷与目录；构建通过不代替导航可用。Markdown HTML 保持禁用，跳转逻辑只在受信任主题读取同目录同基名的导航元数据。

## 工具入口

- `scripts/check-docs.mjs`：当前 Markdown 链接与个人绝对路径检查，扫描范围由脚本的 roots/skippedDirs 定义；`docs/.docsignore` 负责文档站发布过滤，两者不等同。
- `scripts/check-changelog-sync.mjs`：检查用户/部署影响与根 `CHANGELOG.md`；本地叠加暂存和未暂存 tracked 差异，未跟踪文件不在检查集合。Agent 规范与 `docs/changelog.md` 的同步由维护者另外核对。
- `scripts/check-go-live-readiness-doc.mjs`：上线准入和工程成熟度入口检查。
- `scripts/docs-build.sh`、`scripts/docs-prepare.mjs`：统一文档站准备与构建；先运行分卷回归，末尾调用 `scripts/check-docs-bundle-size.mjs`。`scripts/lib/docs-publication.mjs` 与主题 `publicationNavigation.mjs` 分别负责无损发布和浏览器导航；`scripts/tests/docs-publication.test.mjs` 覆盖锚点、块边界及导航目的地约束。

## 写作口径

使用专业、可维护的业务和工程术语。避免临时口头语、机器感描述和重复背景，把入口、边界、操作和验证命令放在前面。

## 全量资料复核

- 用户要求全量时，以当前工作树实际存在的 Git tracked 与未跟踪自有文件建分母，包含 `docs/`、根入口、`e2e-data/`、`scripts/`、`tools/`、设计资料、隐藏目录说明和 Skill；排除依赖与生成站点并记录理由。`check:docs` 的当前文档扫描数不能替代全量覆盖数。
- 逐文件判断长期/阶段、当前/历史、原文更新/增量记录、是否需日期或状态后缀；归档先核对真实职责与调用，不凭文件日期自动判定完成。计划中未验证的事项必须保留状态。
- 文档与脚本的长期职责和 Skill 选择见 `docs/engineering/script-skill-routing.md`；覆盖清单作为日期审计证据维护，不把逐文件列表复制进每个 Skill。归档脚本只作证据，当前 Runbook 不再推荐运行它们。

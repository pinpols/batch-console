# 运维 / QA 索引

## 核心运维流程(权威)

| 文档 | 用途 |
|---|---|
| [CI 门禁](./ci.md) | 核心门禁、兼容、安全与发布 workflow / secrets / 阈值 / 排查表 |
| [GitHub 安全告警治理](./security-alert-governance.md) | 告警分类、修复与误报依据、PR 验证和合并后收尾 |
| [CI 依赖治理](../engineering/ci-dependency-governance.md) | Action、Runner、Artifact 的升级、验证和回滚规则 |
| [开发工作流](./dev-workflow.md) | 本地开发 / 分支 / 提交 / 联调日常流程 |
| [回滚](./rollback.md) | 前端发布回滚步骤 |
| [发布晋级](./release-promotion.md) | 不可变镜像、staging 验收和版本标签晋级 |
| [上线准入清单](./go-live-readiness-checklist.md) | PR 门禁、真实环境、UI 交互和运行时发布证据 |
| [前端事故处理](./frontend-incident.md) | 白屏、静态资源、API 和 PWA 缓存故障 |
| [可观测性](./observability.md) | Sentry、遥测、告警和数据边界 |
| [维护与降级前端实施方案](../engineering/maintenance-degradation-implementation-plan.md) | 维护公告、写操作冻结、503 跳转和下游降级提示 |
| [密码安全历史记录](./password-security-backlog.md) | 2026-05-18 密码治理方案与当前实现差异；不作为现行待办 |

## QA 阶段报告（日期化证据）

- [D 档 QA 阶段总评](../qa/d-tier/) — P1-P5 + P5b 日期化证据(2026-06-03 移到 `docs/qa/d-tier/` 统一 QA 目录)；不替代当前门禁。

## 历史联调计划 / 日期化报告

| 文档 | 阶段 |
|---|---|
| [FE-QA D 档计划](./fe-qa-d-tier-plan.md) | D 档历史执行计划 |
| [FE-QA D 档报告](./fe-qa-d-tier-report.md) | D 档日期化总结 |
| [FE-QA C 档计划](./fe-qa-c-tier-plan.md) | C 档历史执行计划 |
| [FE-QA C 档报告](./fe-qa-c-tier-report.md) | C 档日期化总结 |
| [FE-BE 联测计划](./fe-be-joint-test-plan.md) | 历史联测方案与档位定义 |
| [FE-BE 联测报告](./fe-be-joint-test-report.md) | 日期化联测总报告 |
| [FE-BE 联测 B+/C+ 报告](./fe-be-joint-test-report-bplus-cplus.md) | B+/C+ 日期化增量 |
| [QA C baseline](./qa-c-baseline.md) | C 档历史基线（仅作当时记账，不代表当前门禁） |

## 附加资料

| 文档 | 用途 |
|---|---|
| [Phase 1 API CRUD 历史问题](./be-fix-backlog.md) | 早期联调问题与修复依据；不作为当前待办 |
| [移动端 tunnel](./mobile-frontend-tunnel.md) | 移动端联调隧道方案 |

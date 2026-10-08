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

## QA 阶段报告（日期化证据）

- C/D 档 QA campaign 历史证据位于仓库内 `docs/archive/qa-2026-05/`，不发布到文档站，也不替代当前门禁。

## 历史验收证据

C/D 档 QA campaign、联测计划与历史基线均已关闭并移至仓库内 `docs/archive/qa-2026-05/`。其中的数字是当时快照，不代表当前门禁或发布结论。

## 附加资料

| 文档 | 用途 |
|---|---|
| [Phase 1 API CRUD 历史问题](./be-fix-backlog.md) | 早期联调问题与修复依据；不作为当前待办 |
| [移动端 tunnel](./mobile-frontend-tunnel.md) | 移动端联调隧道方案 |

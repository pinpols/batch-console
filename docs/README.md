# 前端文档索引

本文档是 `batch-console` 的文档入口。所有文档按「权威设计 / 阶段报告 / 归档材料」分层维护:长期规则只放一处,阶段性结论保留日期,过时材料归档参考。

## 项目结构与权威设计

| 文档 | 用途 |
|---|---|
| [项目结构图](./architecture/project-structure.md) | 顶层 + src 子目录 + 关键 composable + npm script(2026-06-03 新增) |
| [前端方案设计说明书 V3](./design/批量调度系统前端方案设计说明书_开发落地版_V3.md) | 前端总体方案:业务域 / 路由 / 页面职责 / 组件分层 / 联调边界 |
| [wrapper 迁移计划](./design/fe-wrapper-migration-plan.md) | wrapper 迁移路径(过渡期方案) |
| [页面命名约定](./design/page-naming-convention.md) | URL / 代码目录 / 侧边栏分组三者一致规则 |
| [前端可观测性方案](./design/前端可观测性方案.md) | 操作日志 / 行为埋点 / Sentry / 错误追踪 |
| [meta-enum 覆盖清单](./design/meta-enum-coverage.md) | 后端枚举元数据 → 筛选项 / 状态标签覆盖 |
| [移动端刷新策略](./design/mobile-refresh-strategy.md) | `/m/*` 下拉 / 自动刷新设计 |
| [内嵌文档中心方案](./design/内嵌文档中心方案.md) | VitePress 文档中心构建 / 部署 |
| [API 文档说明](./api/README.md) | 指向后端权威 OpenAPI / Protocol,前端不维护副本 |

## 运维 / QA

| 文档 | 用途 |
|---|---|
| [运维 / QA 索引](./runbook/README.md) | CI / dev-workflow / rollback / 联测计划与报告入口 |
| [QA D 档总评](./qa/d-tier/) | P1-P5 + P5b 完整闭环 |
| [部署:Docker + Nginx](./deploy/docker-nginx.md) | 容器化部署 |

## 阶段性报告(reports/)

按时间倒序,反映**当时**的实现状态;长期规则看 `design/` 与 `../CLAUDE.md`。

| 日期 | 报告 | 关注点 |
|---|---|---|
| 2026-05-23 | [code-change 影响范围](./reports/code-change-upgrade-scope-2026-05-23.md) | 升级影响范围评估 |
| 2026-05-23 | [依赖升级评估](./reports/dependency-upgrade-evaluation-2026-05-23.md) | npm / Vite / TS 升级评估 |
| 2026-05-19 | [前后端文档整理与深扫](./reports/2026-05-19-前后端文档整理与深扫报告.md) | 契约漂移 / Job Bundle / 分页 / 门禁 |
| 2026-05-16 | [Prod readiness](./reports/2026-05-16-prod-readiness.md) | 上线就绪盘点 |
| 2026-05-16 | [Backlog cleanup](./reports/2026-05-16-backlog-cleanup.md) | backlog 清理 |
| 2026-05-16 | [Deep scan v2](./reports/2026-05-16-deep-scan-v2.md) | 第二轮全方位深扫 |
| 2026-05-15 | [Deep scan v1](./reports/2026-05-15-deep-scan-v1.md) | 第一轮全方位深扫 |
| 2026-05-14 | [UI audit](./reports/2026-05-14-ui-audit.md) | UI 视觉一致性审计 |

> 4 月报告(2026-04-*)已归档到 `archive/`,2026-05-13 IA 重构 / 2026-04-22 UI audit 也已归档。

## 归档材料(archive/)

只保留历史上下文,不作为日常开发入口。包含:
- 4 月旧报告(系统分析 / e2e / 分页迁移 / 审查清单 / 未完成项 / 优化清单 / 作业编排 bug)
- 2026-04-22 Console UI/UX audit / 2026-05-13 IA 重构(已落地)
- 2026-05-21 / 2026-05-23 FE acceptance 报告(历史)
- 2026-04-01 多步骤对话落地指南(早期 AI 协作)

## 常见任务入口

- **了解项目现状**:[architecture/project-structure.md](./architecture/project-structure.md) → 根 [CLAUDE.md](../CLAUDE.md)
- **新增页面**:[design/page-naming-convention.md](./design/page-naming-convention.md) → `src/router/index.ts` → `src/constants/pageMeta.ts` → `src/constants/navigation.ts` → `src/locales/`
- **联调接口**:[api/README.md](./api/README.md) → 后端 `../file-batch-system/docs/api/console-api.openapi.yaml` → `npm run gen:api`
- **排查契约漂移**:后端 `python3 scripts/ci/check-console-openapi-paths.py` → 前端 `npm run gen:api:check`
- **改列表页**:`src/components/table/ProTable.vue` / `ListPageQueryBar.vue`
- **跨仓协作规则**:根 [AGENTS.md](../AGENTS.md)

## 维护规则

- 长期规则放 `design/`,避免散落到报告。
- 阶段性报告放 `reports/`,文件名 `YYYY-MM-DD-` 前缀。
- 已失效流程放 `archive/`,顶部说明当前适用性。
- 新增 / 移动 / 归档文档时同步更新本索引。
- 涉及接口 / 路由 / 导航 / 测试策略的文档变更,应同时核对代码中的权威入口,避免再次漂移。

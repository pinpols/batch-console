# 前端文档索引

本文档是 `batch-console` 的文档入口。所有文档按「权威设计 / 阶段报告 / 归档材料」分层维护:长期规则只放一处,阶段性结论保留日期,过时材料归档参考。

## 产品使用指南

| 文档                                                | 关注角色                       | 用途                                       |
| --------------------------------------------------- | ------------------------------ | ------------------------------------------ |
| [**使用指南首页**](./user-guide/README.md)          | 全部角色                       | 按角色与任务选择操作手册                   |
| [角色与权限](./user-guide/roles-and-access.md)      | 全部角色、账号管理员           | 四类正式角色、前端能力档与权限排查         |
| [角色与页面矩阵](./user-guide/role-page-matrix.md)  | 全部角色、验收人员             | 四类角色对应的页面、入口和验收方法         |
| [快速入门](./user-guide/getting-started.md)         | 全部角色                       | 登录、租户、导航、语言、主题与密码提示     |
| [作业与流程](./user-guide/jobs-and-workflows.md)    | 租户管理员、平台管理员         | 作业、Workflow、Pipeline 配置与验证        |
| [运行与审批](./user-guide/runs-and-approvals.md)    | 运维值班、管理员、审计员       | 运行查询、重试、取消、审批与批次日重放     |
| [文件与配置导入](./user-guide/files-and-imports.md) | 租户管理员、平台管理员         | 渠道、模板、租户配置包与 JSON 同步         |
| [可观测性与排障](./user-guide/observability.md)     | 运维值班、审计员、管理员       | 告警、Outbox、Trace、审计与诊断            |
| [运维工具](./user-guide/operations-tools.md)        | 全部角色                       | 时区、Cron、文件、命名与重试辅助检查       |
| [平台治理](./user-guide/platform-governance.md)     | 平台管理员、租户管理员、审计员 | 账号、Worker、日历、队列、配额、密钥和分片 |
| [常见问题](./user-guide/troubleshooting.md)         | 全部角色                       | 空数据、权限、HTTP 错误、语言和主题问题    |

## 项目结构与权威设计

| 文档                                                                                   | 用途                                                              |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [项目结构图](./architecture/project-structure.md)                                      | 顶层 + src 子目录 + 关键 composable + npm script(2026-06-03 新增) |
| [前端方案设计说明书 V3](./engineering/批量调度系统前端方案设计说明书_开发落地版_V3.md) | 前端总体方案:业务域 / 路由 / 页面职责 / 组件分层 / 联调边界       |
| [Batch Console 重设计资料](./redesign/README.md)                                       | 当前设计来源、覆盖矩阵、原型证据与历史实施计划归档                |
| [wrapper 迁移计划](./engineering/fe-wrapper-migration-plan.md)                         | wrapper 迁移路径(过渡期方案)                                      |
| [页面命名约定](./engineering/page-naming-convention.md)                                | URL / 代码目录 / 侧边栏分组三者一致规则                           |
| [前端可观测性方案](./engineering/前端可观测性方案.md)                                  | 操作日志 / 行为埋点 / Sentry / 错误追踪                           |
| [Console AI 助手前端实施方案](./engineering/ai-assistant-frontend-implementation-plan.md) | 全局入口、页面上下文、会话 UI、移动端与前后端契约                 |
| [当前 AI 与使用率待办](./backlog/ai-and-usage-statistics-todo-2026-09-29.md)             | AI 前端交付、使用率统计联测和暂缓/不做边界                         |
| [运行时与依赖版本](./engineering/runtime-versions.md)                                  | Node 运行约束、锁文件和后端权威支持矩阵                           |
| [环境变量治理](./engineering/environment-variables.md)                                 | 构建期配置、敏感性和 owner                                        |
| [浏览器支持策略](./engineering/browser-support.md)                                     | 桌面/移动支持范围与跨浏览器验收                                   |
| [设计 Token 治理](./engineering/design-tokens.md)                                      | 运行时 token 权威源与视觉变更规则                                 |
| [第三方软件声明](./compliance/THIRD-PARTY-LICENSES.md)                                 | 前端 npm 依赖许可证摘要;SBOM 见同目录 `sbom.json`                 |
| [meta-enum 覆盖清单](./engineering/meta-enum-coverage.md)                              | 后端枚举元数据 → 筛选项 / 状态标签覆盖                            |
| [移动端刷新策略](./engineering/mobile-refresh-strategy.md)                             | `/m/*` 下拉 / 自动刷新设计                                        |
| [统一文档站](./engineering/unified-documentation-site.md)                              | 当前 VitePress 单站构建、路径、部署与权限边界                     |
| [内嵌文档中心方案](./engineering/内嵌文档中心方案.md)                                  | 早期后端独立站方案（历史参考）                                    |
| [API 文档说明](./api/README.md)                                                        | 指向后端权威 OpenAPI / Protocol,前端不维护副本                    |

## 运维 / QA

| 文档                                            | 用途                                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------------- |
| [**前端测试体系**](./testing/README.md)         | ★ 测试分层 / 可复用 helper / 可复制测试案例模板 / 运行 / CI 门禁 / 常见坑(写测试先读) |
| [运维 / QA 索引](./runbook/README.md)           | CI / dev-workflow / rollback / 联测计划与报告入口                                     |
| [审计资料索引](./audits/README.md)              | UI / UX / 可用性审计证据与截图                                                        |
| [QA D 档总评](./qa/d-tier/)                     | P1-P5 + P5b 完整闭环                                                                  |
| [部署:Docker + Nginx](./deploy/docker-nginx.md) | 容器化部署                                                                            |
| [部署:裸 Linux + Nginx](./deploy/linux-nginx.md) | 原生 Nginx、静态制品、HTTPS、发布与回滚                                                |
| [发布晋级](./runbook/release-promotion.md)      | staging 验收、不可变镜像晋级和发布阻断                                                |
| [前端事故处理](./runbook/frontend-incident.md)  | 白屏、静态资源、API、缓存与 CSP 故障处置                                              |
| [可观测性运行手册](./runbook/observability.md)  | Sentry、遥测、采样和告警边界                                                          |

## 阶段性报告(reports/)

按时间倒序,反映**当时**的实现状态;长期规则看 `engineering/` 与 `../AGENTS.md`。

| 日期       | 报告                                                                      | 关注点                              |
| ---------- | ------------------------------------------------------------------------- | ----------------------------------- |
| 2026-05-23 | [code-change 影响范围](./reports/code-change-upgrade-scope-2026-05-23.md) | 升级影响范围评估                    |
| 2026-05-23 | [依赖升级评估](./reports/dependency-upgrade-evaluation-2026-05-23.md)     | npm / Vite / TS 升级评估            |
| 2026-05-19 | [前后端文档整理与深扫](./reports/2026-05-19-前后端文档整理与深扫报告.md)  | 契约漂移 / Job Bundle / 分页 / 门禁 |
| 2026-05-16 | [Prod readiness](./reports/2026-05-16-prod-readiness.md)                  | 上线就绪盘点                        |
| 2026-05-16 | [Backlog cleanup](./reports/2026-05-16-backlog-cleanup.md)                | backlog 清理                        |
| 2026-05-16 | [Deep scan v2](./reports/2026-05-16-deep-scan-v2.md)                      | 第二轮全方位深扫                    |
| 2026-05-15 | [Deep scan v1](./reports/2026-05-15-deep-scan-v1.md)                      | 第一轮全方位深扫                    |
| 2026-05-14 | [UI audit](./reports/2026-05-14-ui-audit.md)                              | UI 视觉一致性审计                   |

> 4 月报告(2026-04-\*)已归档到 `archive/`,2026-05-13 IA 重构 / 2026-04-22 UI audit 也已归档。

## 部署 / CD 验证记录(verifications/)

真实环境跑通的验证留痕(发布 / CD 流程实测,非日常开发入口)。

| 日期       | 验证                                                                 | 关注点              |
| ---------- | -------------------------------------------------------------------- | ------------------- |
| 2026-05-28 | [CD E2E](./verifications/cd-e2e-2026-05-28.md)                       | CD 流水线端到端验证 |
| 2026-05-28 | [CD 前端脚本部署](./verifications/cd-fe-script-deploy-2026-05-28.md) | 前端脚本化部署验证  |

## 归档材料(archive/)

只保留历史上下文,不作为日常开发入口。包含:

- 4 月旧报告(系统分析 / e2e / 分页迁移 / 审查清单 / 未完成项 / 优化清单 / 作业编排 bug)
- 2026-04-22 Console UI/UX audit / 2026-05-13 IA 重构(已落地)
- 2026-05-21 / 2026-05-23 FE acceptance 报告(历史)
- 2026-04-01 多步骤对话落地指南(早期 AI 协作)

## 常见任务入口

- **了解项目现状**:[architecture/project-structure.md](./architecture/project-structure.md) → 根 [AGENTS.md](../AGENTS.md)
- **新增页面**:[engineering/page-naming-convention.md](./engineering/page-naming-convention.md) → `src/router/index.ts` → `src/constants/pageMeta.ts` → `src/constants/navigation.ts` → `src/locales/`
- **联调接口**:[api/README.md](./api/README.md) → 后端 `../file-batch-system/docs/api/console-api.openapi.yaml` → `npm run gen:api`
- **排查契约漂移**:后端 `python3 scripts/ci/check-console-openapi-paths.py` → 前端 `npm run gen:api:check`
- **改列表页**:`src/components/table/ProTable.vue` / `ListPageQueryBar.vue`
- **跨仓协作规则**:根 [AGENTS.md](../AGENTS.md)

## 维护规则

> AGENTS.md 规范条款本身的变化(结构 / 构建 / 架构约束 / 编码红线 / i18n / 测试范围)记在 [`changelog.md`](./changelog.md),日期倒序。

- 长期工程规则放 `engineering/`,视觉重设计资产放根 `../design/`,避免散落到报告。
- 阶段性报告放 `reports/`,文件名 `YYYY-MM-DD-` 前缀。
- 已失效流程放 `archive/`,顶部说明当前适用性。
- 新增 / 移动 / 归档文档时同步更新本索引。
- 涉及接口 / 路由 / 导航 / 测试策略的文档变更,应同时核对代码中的权威入口,避免再次漂移。

# 前端文档逐项审查报告（2026-10-07）

## 结论

本轮逐类核对了根入口、文档索引、用户指南、工程规范、API 契约、测试、运行手册、部署、设计资料、审计/报告和归档材料。文档链接、统一文档站构建和上线准入文档门禁均通过；未修改根目录 `design/`。

本轮需要更新的不是业务代码，而是“当前方案”和“历史证据”的状态表达：已完成能力不能继续写成待实施步骤，历史测试数字不能被误读为当前门禁结果。

## 核查范围

| 类别 | 处理原则 | 结论 |
|---|---|---|
| 根入口、AGENTS、CONTRIBUTING、SECURITY | 启动、分支、架构红线和协作规则 | 保持不变；当前命令与代码一致 |
| `docs/README.md` 与各级 README | 入口、索引、权威来源 | 已更新索引描述；链接无失效 |
| `docs/engineering/` | 当前工程规则、契约和实施记录 | 更新 API、使用率、维护降级、AI 状态口径；wrapper 迁移仍保留为未完成分批记录 |
| `docs/user-guide/` | 面向用户的操作说明 | 未发现本轮需要改的路径或命令漂移 |
| `docs/testing/`、`docs/runbook/` | 测试命令、CI、部署和排障 | 当前入口保持；补充历史 QA 基线标识 |
| `docs/deploy/`、统一文档站 | 本地/容器/裸机部署和 `/docs/` | 与 `package.json`、Nginx 和脚本一致 |
| `docs/audits/`、`docs/reports/`、`docs/verifications/`、`docs/qa/` | 日期化证据 | 按历史证据保留，不把旧数字改写成当前数字 |
| `docs/archive/` 与根 `design/` | 追溯资料、只读设计输入 | 不修改 |

## 已更新文档

- `docs/api/README.md`：明确后端 OpenAPI/Controller/Protocol 是当前权威；2026-05-19 扫描报告改为历史证据。
- `docs/README.md`、`docs/engineering/README.md`：将 wrapper、AI、使用率和降级入口改为“记录/验收边界”口径，减少把已完成方案显示为待办。
- `docs/engineering/console-usage-statistics-plan.md`：使用率页面、API 和阶段交付改为已落地记录；后续契约变更保留生成类型和漂移检查流程。
- `docs/engineering/maintenance-degradation-implementation-plan.md`：P0/P1 改为历史实施记录，明确真实设备和外部下游仍是环境验收边界。
- `docs/engineering/ai-assistant-frontend-implementation-plan.md`、`ai-image-conversation-plan.md`：补充证据快照日期与“本次未重新宣称重跑真实联测”的边界。
- `docs/runbook/README.md`、`fe-be-joint-test-plan.md`、C/D 档 QA 计划与联测报告：明确为历史执行方案或日期化证据，避免执行旧 spec/工具路径。
- `docs/runbook/qa-c-baseline.md`、`docs/backlog/fe-acceptance-2026-08-28.md`、`fe-acceptance-2026-08-31.md`、`fe-acceptance-2026-09-01.md`：补充历史快照提示，保留原始测试数字。

## 明确保留的未完成项

1. `docs/engineering/fe-wrapper-migration-plan.md`：仍有 generated request/query/page 类型迁移和后端具名 schema 补齐边界，不能改成“全部完成”。
2. `docs/runbook/compose-cd-roadmap.md`：仍是 Compose CD 规划，不能把路线图当成已落地生产部署。
3. AI、图片、使用率和维护方案中的真实设备、真实供应商主动限流/超时、对象存储删除残留、生产账单对账等，继续作为环境验收边界，不用本地 mock 结果替代。
4. 最新 UI/发布验收矩阵中的未验证项继续以日期报告保存，不能通过改文案清除缺口。

## 复核命令

```text
npm run check:docs
npm run check:go-live-readiness
npm run docs:build
```

本轮结果：三项均通过；统一文档站成功生成，文档 chunk 和搜索索引体积预算通过。

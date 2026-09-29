# AI 与使用率统计当前待办

> 核查日期：2026-09-29。本文是前端当前 AI/使用率统计事项的登记入口，不代表功能已经实现。已有验收 backlog 的历史结论不因本文重新打开。

## 状态口径

| 状态 | 含义 |
|---|---|
| ⏳ 待做 | 有明确前端交付物，尚未实现或尚未完成联测 |
| 🔒 等后端 | 后端 OpenAPI、授权或持久化契约未冻结，前端不伪造实现 |
| 🟡 暂缓 | 已有方案，但当前不进入开发，等待外部条件或真实证据 |
| ❌ 不做 | 已明确超出当前范围，保留决策记录防止重复立项 |

权威方案：

- [Console AI 助手前端实施方案](../engineering/ai-assistant-frontend-implementation-plan.md)
- [Console 使用率统计前端方案](../engineering/console-usage-statistics-plan.md)
- 配对后端方案：`file-batch-system/docs/plans/ai-assistant-contextual-experience-and-cost-governance-2026-09-29.md`
- 配对后端方案：`file-batch-system/docs/plans/console-usage-statistics-plan-2026-09-29.md`

## AI 助手

前端只负责入口、交互、最小页面上下文和状态呈现；认证、租户隔离、领域授权、拒答、费用限制和真实数据读取由后端负责。

| ID | 交付物 | 状态 | 依赖 |
|---|---|---|---|
| **FE-AI-1** | 对齐版本化聊天请求、页面上下文白名单、稳定错误码和来源引用 DTO | 🔒 等后端 | 后端 OpenAPI/授权契约 |
| **FE-AI-2** | 桌面/移动全局入口、非持久化面板、键盘焦点、租户切换清理 | ⏳ 待做 | FE-AI-1 |
| **FE-AI-3** | 服务端会话列表、分页恢复、过期/删除/并发发送状态 | 🔒 等后端 | 会话 API 与保留策略 |
| **FE-AI-4** | 国际化、可访问性、越权/拒答/限流/超时/跨租户 Playwright 和单测 | ⏳ 待做 | FE-AI-1、FE-AI-2 |

## 使用率统计

前端埋点只用于页面访问、入口点击和排障趋势，不能替代后端操作审计或业务终态。业务成功率必须以后端操作审计、`job_task`/`job_instance` 和文件校验结果为准。

| ID | 交付物 | 状态 | 依赖 |
|---|---|---|---|
| **FE-USAGE-1** | 固化页面/指标编码，保持中英文文案、按钮文本和 metric code 解耦 | ⏳ 待完成 | 后端指标目录 |
| **FE-USAGE-2** | `usage-summary` OpenAPI 类型、API client、权限和租户筛选 | 🔒 等后端 | 后端 DTO/API |
| **FE-USAGE-3** | 观测分组下的只读使用率趋势页面、空态、错误态和日期范围限制 | ⏳ 待做 | FE-USAGE-2 |
| **FE-USAGE-4** | 与直接 SQL 汇总对账，覆盖租户隔离、失败不计成功、重复事件、版本维度和接口失败 | ⏳ 待联测 | 后端聚合表/测试数据 |

## 决策锁定

| 范围 | 状态 | 说明 |
|---|---|---|
| Spring AI M3 → GA | 🟡 暂缓 | 等上游发布，当前不做前端适配升级 |
| 外部 AI provider 契约接入 CI | ❌ 不做 | 需要外部 secrets；不在前端仓库伪造 provider 验证 |
| AI 上线判定/受控试生产 | 🟡 暂缓 | 等后端质量、成本和权限证据 |
| Phase 3 AI 直接写操作/HITL | 🟡 后置 | 继续链接到现有审批和运维页面，不新增 AI 写入口 |
| 使用率 Kafka/ClickHouse/通用行为分析 | ❌ 不做 | 第一版采用后端 PostgreSQL 日聚合，避免越界和重复建设 |

## 前端验收门槛

实现阶段至少执行：

```text
npm run typecheck
npm run lint
npm run check:i18n
npm run check:docs
npm run test:unit
npm run gen:api:check
```

涉及真实后端契约时，再执行前端验收脚本和配对后端联测；mock 通过不能替代租户隔离、权限和业务终态验证。

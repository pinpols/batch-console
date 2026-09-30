# AI 与使用率统计当前待办

> 复核日期：2026-10-01。本文区分已接入的前端代码、真实本地联测和仍缺失的后端/环境证据；不以 mock 通过代替上线验收。

## 状态口径

| 状态 | 含义 |
|---|---|
| 🟠 进行中 | 已实现部分前端能力，但契约或联测覆盖尚未满足完整验收 |
| ✅ 已验证 | 有对应代码、测试和真实后端证据 |
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
| **FE-AI-1** | 对齐版本化聊天请求、页面上下文白名单、稳定错误码和来源引用 DTO | 🟠 进行中 | `contextVersion=v1` 和页面类型白名单已接；响应仍无结构化来源引用，授权能力未出现在 `/auth/me` |
| **FE-AI-2** | 桌面/移动全局入口、非持久化面板、键盘焦点、租户切换清理 | 🟠 进行中 | 双端入口、租户清理和焦点返回已实现；390px 浏览器已验证移动抽屉输入聚焦、输入区可见和关闭后焦点返回，真实软键盘仍待人工验收 |
| **FE-AI-3** | 服务端会话列表、分页恢复、过期/删除/并发发送状态 | 🟠 进行中 | 前端已接列表、游标翻页、历史、删除和成本摘要；安全模式后端 + 本地模型桩已通过浏览器创建、刷新恢复和删除；历史拒答/预算决策可恢复，发送中编辑的新草稿不会被清空；独立后端真实 HTTP + 浏览器已验证 23 条会话分成 20+3 两页、无重复、末页收起按钮，非法游标返回 400，联调数据已清理；会话切换加载与删除迟到响应、`NOT_FOUND` 失效提示已有路由模拟回归，真实过期与并发链路仍待验收 |
| **FE-AI-4** | 国际化、可访问性、越权/拒答/限流/超时/跨租户 Playwright 和单测 | 🟠 进行中 | 双语、历史预算拒答、HTTP 限流/拒绝/不可用/超时的页面错误映射和真实安全模式 CSRF 已测；外部 provider、真实限流/超时及跨租户会话验收仍缺 |

## 使用率统计

前端埋点只用于页面访问、入口点击和排障趋势，不能替代后端操作审计或业务终态。业务成功率必须以后端操作审计、`job_task`/`job_instance` 和文件校验结果为准。

| ID | 交付物 | 状态 | 依赖 |
|---|---|---|---|
| **FE-USAGE-1** | 固化页面/指标编码，保持中英文文案、按钮文本和 metric code 解耦 | 🟠 进行中 | 页面只读展示后端 `metricCode`；指标目录/本地化标签仍需冻结 |
| **FE-USAGE-2** | `usage-summary` OpenAPI 类型、API client、权限和租户筛选 | ✅ 已验证 | 生成类型、typed wrapper、权限路由；真实后端 tenant admin 查本租户 200、跨租户 403 |
| **FE-USAGE-3** | 观测分组下的只读使用率趋势页面、空态、错误态和日期范围限制 | 🟠 进行中 | `/observability/usage` 已实现；当前是审计日志下二级入口，尚未进入独立观测菜单分组 |
| **FE-USAGE-4** | 与直接 SQL 汇总对账，覆盖租户隔离、失败不计成功、重复事件、版本维度和接口失败 | 🟠 进行中 | 本地 `ta` 聚合 API 与 `batch.console_usage_daily` 对账为 2 事件/2 成功/0 失败；后端 `ConsoleUsageDailyIntegrationTest` 在最新基线通过并发计数、失败数和数据库 RLS 隔离 2 例；前端已测接口失败重试及跨租户 403。当前后端仅投影操作审计，页面已避免把该计数称作业务终态；重复事件、版本维度和真实业务操作到聚合的完整 E2E 对账仍待补 |

## 维护与服务降级

权威实施方案：[Console 维护与降级前端实施方案](../engineering/maintenance-degradation-implementation-plan.md)。配对后端清单见 `file-batch-system/docs/analysis/todo-master.md` 的 G6；本节只登记前端交付物，不重新定义后端契约。

| ID | 交付物 | 状态 | 依赖 |
|---|---|---|---|
| **FE-MAINT-1** | 维护状态增加 version、同步时间、同步失败和 stale 状态 | ✅ 已完成 | 后端维护状态版本字段已同步到 OpenAPI |
| **FE-MAINT-2** | 统一写操作守卫，覆盖作业、工作流、批量日、运维动作和配置导入 | ✅ 已完成 | 请求拦截器统一兜底，后端 503 仍为最终防线 |
| **FE-MAINT-3** | 维护 503 即时进入 `/maintenance`，恢复后安全回跳 | ✅ 已完成 | 已覆盖即时跳转、原路由保留和恢复重试 |
| **FE-DEGRADE-1** | 消费 `X-Degraded-Source`，展示可解释的非阻塞降级提示 | ✅ 已验证 | Trigger 停止时真实 `/scheduler/status` 和 `/ops/triggers` 返回 `X-Degraded-Source: trigger`；拦截器、Banner 和 Trigger 空态已验证 |
| **FE-DEGRADE-2** | 桌面/移动端降级、恢复、长公告、多语言和布局 E2E | 🟠 进行中 | 桌面真实降级与双语 E2E 已覆盖；模拟来源停止后的 60 秒 TTL 恢复、长公告在 390px/1280px 宽度下不截断已通过 E2E；390px 手机尺寸浏览器连接真实摘要 API，注入 `X-Degraded-Source` 后横幅完整显示，恢复为无降级头后清除。真实下游故障到移动端恢复链路仍待验收 |

明确不做：前端自判 5xx 为降级、通用故障注入操作台、工单/通知平台和新的编排入口。

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

# 控制台筛选下拉：后端元数据覆盖说明

## 已对接的后端接口

| 接口 | 用途 |
|------|------|
| `GET /api/console/meta/enums` | 枚举字典（键名以后端实际 `data` 为准） |
| `GET /api/console/meta/worker-groups?tenantId=` | Worker 组代码列表 |
| `GET /api/console/meta/calendars?tenantId=` | 日历编码列表（批次日等） |
| `GET /api/console/meta/queues?tenantId=` | 队列（Job 定义等已用） |
| `GET /api/console/query/job-definitions` | Job Code（聚合） |
| `GET /api/console/query/workflow-definitions` | Workflow Code |
| 各业务 `query/*` 列表 | 从返回行归纳的「动态选项」（如审批类型、审计操作类型） |

前端实现：优先使用 **meta/enums** 与 **meta/*** 及 **query** 结果；仅在 **接口无数据或契约未声明该分组** 时，回退到本地 `constants/status.ts` 或当前列表数据归纳。

## 协议文档已写的 `meta/enums` 分组（console-api-protocol.md）

`triggerType`, `jobType`, `scheduleType`, `triggerMode`, `shardStrategy`, `retryPolicy`, `instanceStatus`, `workflowNodeType`, `channelType`。

## 建议后端补充（当前协议未列举、前端已做探测 key / 回退）

若下列字典出现在 `meta/enums` 的 `data` 中，前端会**自动优先使用**（见 `pickMetaEnumGroup` 调用处）：

| 业务场景 | 建议响应键名（任选其一即可被探测） |
|----------|-------------------------------------|
| Workflow Run 状态 | `workflowRunStatus`, `runStatus` |
| Worker 连接状态 | `workerStatus`, `workerRegistryStatus` |
| Job 步骤 / 分区状态 | `partitionStatus`, `stepStatus`, `jobStepStatus` |
| 审批状态 | `approvalStatus` |
| 配置发布状态 | `configReleaseStatus`, `configStatus` |
| 审计 / 执行日志操作结果 | `operationResult`, `auditOperationResult`, `opResult` |
| Outbox 重试状态 | `outboxRetryStatus`, `retryStatus` |
| Outbox 投递状态 | `outboxDeliveryStatus`, `deliveryStatus` |
| Catch-up 请求状态 | `catchUpRequestStatus`, `pendingCatchUpStatus`, `requestStatus` |
| 文件状态 / 业务类型（文件列表） | `fileStatus`, `bizType` |
| 审批类型 | `approvalType` |
| AI 审计 Prompt 分类 | `aiPromptCategory`, `promptCategory` |

## 暂无合适字典接口、依赖「列表数据归纳」的字段

以下字段在 **`meta/enums` 未返回对应分组时**，控制台仍会用**已拉取的列表数据**归纳选项（并支持 `allow-create` 等手输）：

- **审批类型** `approvalType`：`query/approvals` 行归纳。
- **AI 审计分类** `promptCategory`：`query/ai-audits` 行归纳。
- **审计操作类型** `operationType`：`query/audits` 行归纳。

如需上述也为纯字典驱动，建议在 `meta/enums` 中增加对应数组字段，或提供独立 `GET /api/console/meta/...` 只读接口。

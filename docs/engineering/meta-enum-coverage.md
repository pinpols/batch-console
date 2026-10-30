# 控制台筛选下拉与后端元数据

## 权威来源

枚举及对象字典由配对后端 `ConsoleMetaQueryService`、Controller 与 OpenAPI 维护。前端通过 `src/api/meta.ts` 和既有查询客户端读取，不在文档复制完整、容易漂移的枚举值表。

| 入口 | 当前用途 |
|---|---|
| `GET /api/console/meta/enums` | 作业、Workflow、运行、审批、配置、Worker、Outbox、AI、文件、日历与资源治理的注册枚举 |
| `GET /api/console/meta/worker-groups` | 当前租户 Worker 组代码 |
| `GET /api/console/meta/calendars` | 当前租户日历编码 |
| `GET /api/console/meta/queues` | 当前租户队列 |
| 作业、Workflow 等领域查询 | 对象引用选择；按当前接口筛选与分页契约加载 |

`workflowRunStatus`、`workerStatus`、`partitionStatus`、`approvalStatus`、`approvalType`、`configStatus`、`operationType`、`operationResult`、`outboxPublishStatus`、`aiPromptCategory`、`fileStatus` 等已在当前后端注册；不再将它们列为“后端尚未提供”的建议项。具体字段与值以生成类型和当前响应为准。

## 前端选择与回退

- 优先读取后端当前 `meta/enums` 分组及对象字典，使用 `src/api/meta.ts` 的转换方法维护 option 形状。
- 存量调用可能通过 `pickMetaEnumGroup` 探测兼容键；兼容别名不代表后端同时承诺多个权威键。
- 只有响应缺少相应分组或确属列表派生字段时，才按现有实现回退到本地契约常量或当前页数据；不要把一页查询结果称作完整枚举。
- 引用对象的选项不足时，检查服务器筛选、分页和租户；不得用静默全量聚合替代高基数对象查询。
- 新增分组先核对后端注册与 OpenAPI，再同步生成类型、消费页面和必要的契约回归。

## 复核入口

后端注册实现：[`ConsoleMetaQueryService.java`](../../../file-batch-system/batch-console-api/src/main/java/io/github/pinpols/batch/console/application/rbac/ConsoleMetaQueryService.java)；前端消费：[`src/api/meta.ts`](../../src/api/meta.ts)。接口变更按 `frontend-api-contract` 执行，`npm run gen:api:check` 检查生成契约漂移，不证明所有业务枚举都已做真实环境验收。

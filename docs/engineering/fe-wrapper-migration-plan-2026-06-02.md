# FE 手写 Wrapper 到 OpenAPI 类型迁移计划

> 原始阶段基线：2026-06-02（首次提交 `ebeec26`）。2026-10-25 仅按当前 WDI 源码复核；已迁移批次与尚需逐端点核对的迁移范围分开记录，未重跑 API 联调。

来源:Round-1 TOP-10 R3-7。PR #253 已让 BE OpenAPI schema 完善,#41 重新生成了
`src/types/api.generated.ts`,`src/types/console-api.ts` 抽离了常用 schema 别名。

早期 PR 先做 PoC 迁移 2 个 wrapper,用于验证 generated types 与手写 interface 的字段一致性、
派生(`operations[...]['requestBody']`、`responses[...]`)的可读性,以及对 view 层
零侵入的可行性。2026-09-30 又完成审批、告警、审计查询参数迁移，三者直接从
`operations[...]` 派生筛选类型，并删除对应全量聚合兼容入口。

## 已迁移批次

### 1. `src/api/webhooks.ts`(简单 — 纯 CRUD)
- `CreateWebhookBody` / `UpdateWebhookBody` 改为 `operations[...]['requestBody'].content['application/json']` 派生。
- 字段对齐 100%(`name / callbackUrl / eventTypes / secret / enabled?`)。
- 当前响应已经使用 `WebhookSubscriptionResponse` 与 `WebhookDeliveryLogResponse`；旧的 generic/unknown 等待项已被后端具名 schema 和现有 wrapper 取代。
- 调用方 `NotificationWebhooksTab.vue` 未引用 body interface,**view 层零改动**。

### 2. `src/api/operationAudits.ts`(复杂 — 分页 / query / 嵌套 response)
- `OperationAuditResponse` 改为 `components['schemas']['ConsoleOperationAuditResponse']` 别名
  (新增进 `console-api.ts`)。
- `OperationAuditQuery` 从 `operations['queryOperationAudits']['parameters']['query']` 派生。
- `OperationAuditPage` 从 `components['schemas']['CommonResponseConsoleOperationAuditList']['data']` 派生。
- 调用方 `OperationAuditList.vue` 因 generated 把 page 字段标 optional,加了 `?? []` / `?? 0` 兜底
  (语义等价,只是显式)。

### 3. 运行态查询参数

- `src/api/approvals.ts` → `operations['queryApprovals']`。
- `src/api/alertsQuery.ts` → `operations['queryAlerts']`。
- `src/api/observabilityQueries.ts` 的审计查询 → `operations['queryAuditLogs']`。
- 页面 envelope 暂保留统一 `PageResponse<T>`：后端通用 `PageResponse` 在 OpenAPI 中丢失 item
  泛型，直接派生只能得到 `unknown[]`，此处不制造“看似 generated、实为强转”的假类型。

## 字段不一致(已在 wrapper 注释里记录)

| 位置 | 旧 FE 手写 | BE generated | 处理 |
| --- | --- | --- | --- |
| `OperationAuditResponse.operatorId/operatorRole/errorCode/errorMessage/params/traceId/requestId/ipHash/uaHash` | `string \| null`(必填) | `?: string \| null`(optional) | 读取兼容,采用 generated |
| `OperationAuditPage.total/pageNo/pageSize/items` | required | optional | view 层加 `?? 0` / `?? []` 兜底 |
| `OperationAuditQuery.result` | `'SUCCESS' \| 'FAILED' \| ''` | `'SUCCESS' \| 'FAILED'` | wrapper 里 `Omit + 扩出空串字面量`,保留表单未选语义 |
| `OperationAuditQuery.pageNo/pageSize` | required | optional | 暂保持 generated 形状;view 层始终传值,无影响 |

## 剩余范围 + 风险

- wrapper 数量会随业务变化，不再在长期文档固化瞬时统计；以 `src/api/*.ts` 和
  generated type import 的当前扫描结果为准。
- 使用 `@/types/console-api` 别名不代表请求、查询和 envelope 自动全部派生。当前 `approvals.ts` 的普通审批查询已经从 `operations['queryApprovals']` 派生；Catch-up 查询等仍有手写筛选类型。剩余范围按每个导出类型与 OpenAPI 对照，不用模块名笼统标记全部未迁移。
- 若当前具体端点仍以 `CommonResponseObject` 兜底，先在后端补具名 schema 后迁移；不能把历史 tags/apiKeys/webhooks 等名单当作当前缺失清单。已有具名响应直接引用生成类型，无法精确派生的边界保持明确，不用强转伪造类型安全。
- 风险点:
  1. **Optional vs Required 漂移**:BE generated 对 nullable 字段习惯标 `?:`,旧 FE 手写常标 required。
     批量迁时 view 层可能出现 TS error,需要 `?? fallback` 兜底(本 PR 已示范)。
  2. **Query 字段 union 收窄**:旧 FE 常允许 `''` 空串当未选,BE 枚举严格不接受,wrapper 层
     `Omit + 扩展` 解决(本 PR `result` 字段已示范)。
  3. **Page envelope 命名不规则**:BE 既有 `CommonResponseConsoleXxxList`(嵌套 `data: { items, total, ... }`)
     也有 `PageResponse<Xxx>`(item 直接铺平),迁移时要区分,follow-up 应统一一种入口。
  4. **生成类型消费**：保持 type-only import；是否经 `console-api.ts` 别名由复用和可读性决定。生成行数或一次冷启动耗时不作为长期迁移约束。

## 后续 follow-up 拆批建议

1. **Batch A(优先,低风险)**:已用 `console-api` 别名的 wrapper(`approvals / workers /
   configReleases / file / fileChannelsQuery / ...`)的 request body 派生 + query 派生,
   逐端点核实已迁移与未迁移字段，不预设文件数或零调用方影响。
2. **Batch B**:有具名 page envelope schema 的 wrapper(`queries/*`、`alertsQuery`、
   `observabilityQueries`、`workflowRuns`、`tenants` 等),迁 page 类型。
3. **Batch C**:BE 仍是 `CommonResponseObject` 的 wrapper(当前仍缺少具名响应的端点),先 push BE 补具名 schema,
   FE 再批量迁。
4. **Batch D**:`adapters.ts` / `pagination.ts` 这类公共工具,评估是否应基于 generated
   PageResponse 重写。

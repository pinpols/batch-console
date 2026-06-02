# FE 手写 wrapper → OpenAPI generated types 迁移计划

来源:Round-1 TOP-10 R3-7。PR #253 已让 BE OpenAPI schema 完善,#41 重新生成了
`src/types/api.generated.ts`(~16k 行),`src/types/console-api.ts` 抽离了常用 schema 别名。

本 PR 仅做 PoC 迁移 2 个 wrapper,用于验证 generated types 与手写 interface 的字段一致性、
派生(`operations[...]['requestBody']`、`responses[...]`)的可读性,以及对 view 层
零侵入的可行性。**剩余 wrapper 留作后续批量 follow-up。**

## 已迁移(2)

### 1. `src/api/webhooks.ts`(简单 — 纯 CRUD)
- `CreateWebhookBody` / `UpdateWebhookBody` 改为 `operations[...]['requestBody'].content['application/json']` 派生。
- 字段对齐 100%(`name / callbackUrl / eventTypes / secret / enabled?`)。
- Response 端 BE 仍是 generic `CommonResponseObject`(BE 未具名 Webhook schema),
  本 PR 保持 `unknown`,等 BE 补 schema 后再回填强类型。
- 调用方 `NotificationWebhooksTab.vue` 未引用 body interface,**view 层零改动**。

### 2. `src/api/operationAudits.ts`(复杂 — 分页 / query / 嵌套 response)
- `OperationAuditResponse` 改为 `components['schemas']['ConsoleOperationAuditResponse']` 别名
  (新增进 `console-api.ts`)。
- `OperationAuditQuery` 从 `operations['queryOperationAudits']['parameters']['query']` 派生。
- `OperationAuditPage` 从 `components['schemas']['CommonResponseConsoleOperationAuditList']['data']` 派生。
- 调用方 `OperationAuditList.vue` 因 generated 把 page 字段标 optional,加了 `?? []` / `?? 0` 兜底
  (语义等价,只是显式)。

## 字段不一致(已在 wrapper 注释里记录)

| 位置 | 旧 FE 手写 | BE generated | 处理 |
| --- | --- | --- | --- |
| `OperationAuditResponse.operatorId/operatorRole/errorCode/errorMessage/params/traceId/requestId/ipHash/uaHash` | `string \| null`(必填) | `?: string \| null`(optional) | 读取兼容,采用 generated |
| `OperationAuditPage.total/pageNo/pageSize/items` | required | optional | view 层加 `?? 0` / `?? []` 兜底 |
| `OperationAuditQuery.result` | `'SUCCESS' \| 'FAILED' \| ''` | `'SUCCESS' \| 'FAILED'` | wrapper 里 `Omit + 扩出空串字面量`,保留表单未选语义 |
| `OperationAuditQuery.pageNo/pageSize` | required | optional | 暂保持 generated 形状;view 层始终传值,无影响 |

## 剩余范围 + 风险

- 仓内手写 wrapper 总数:**51 个**(`src/api/*.ts` 去测试文件后),本 PR 迁 2 个,**剩余 49 个**。
- 已经使用 `@/types/console-api` 别名的 wrapper(`approvals / configReleases / workers /
  configReleases / file / ...`)只是 response item 已对齐,**request body / page envelope
  / query 仍是手写**,属于 follow-up 范围。
- BE 仍以 `CommonResponseObject`(`data?: unknown`)兜底的端点(`tags / apiKeys /
  webhooks / notifications / system parameters / 大量 dashboard 接口`等),需先推 BE 补具名
  schema,FE 再迁。本 PR 这类只迁 request body,**不动 response 强类型**,避免假强类型。
- 风险点:
  1. **Optional vs Required 漂移**:BE generated 对 nullable 字段习惯标 `?:`,旧 FE 手写常标 required。
     批量迁时 view 层可能出现 TS error,需要 `?? fallback` 兜底(本 PR 已示范)。
  2. **Query 字段 union 收窄**:旧 FE 常允许 `''` 空串当未选,BE 枚举严格不接受,wrapper 层
     `Omit + 扩展` 解决(本 PR `result` 字段已示范)。
  3. **Page envelope 命名不规则**:BE 既有 `CommonResponseConsoleXxxList`(嵌套 `data: { items, total, ... }`)
     也有 `PageResponse<Xxx>`(item 直接铺平),迁移时要区分,follow-up 应统一一种入口。
  4. **`api.generated.ts` 体积**:16278 行,纯 type-only import 不进 bundle,但 IDE / vue-tsc
     冷启动慢约 1-2 s。维持 `console-api.ts` 中间层是必要的。

## 后续 follow-up 拆批建议

1. **Batch A(优先,低风险)**:已用 `console-api` 别名的 wrapper(`approvals / workers /
   configReleases / file / fileChannelsQuery / ...`)的 request body 派生 + query 派生,
   预计 ~15 个文件,view 层无侵入。
2. **Batch B**:有具名 page envelope schema 的 wrapper(`queries/*`、`alertsQuery`、
   `observabilityQueries`、`workflowRuns`、`tenants` 等),迁 page 类型。
3. **Batch C**:BE 仍是 `CommonResponseObject` 的 wrapper(`tags / apiKeys / webhooks /
   notifications / systemParameters / dashboard / ...`),先 push BE 补具名 schema,
   FE 再批量迁。
4. **Batch D**:`adapters.ts` / `pagination.ts` 这类公共工具,评估是否应基于 generated
   PageResponse 重写。

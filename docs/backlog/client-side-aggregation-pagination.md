# Backlog: 客户端全量聚合(fetchAllPageItems)→ 服务端分页迁移

> 状态:**待立项**。前端审查 2026-06-21 P5;非 bug、是大租户下的性能 + 数据完整性隐患。
> 已修的 P1-P4 在 PR #133;本项因跨多页、影响面大,刻意单独立项,不夹在 fix PR 里。

## 问题

`src/api/adapters.ts` 的 `fetchAllPageItems` 把分页 query **拉满到单数组**(端上筛选/关联解析用)。
默认上限 **`pageSize=200 × maxPages=20 = 4000` 条**,超出即**静默截断**(只 `console.warn`,用户无感)。

大租户下后果:
- **数据不完整**:超 4000 条的运行态列表(审计/告警/审批/step instance)只显示前 4000,用户看不到全部却无提示。
- **性能**:最多 20 次串行分页请求 + 端上聚合,首屏慢。

## 调用面分类(2026-06-21 实查)

### 🔴 高流量运行态 — 真隐患,该迁服务端分页
| 文件 | 端点 | 说明 |
|---|---|---|
| `src/api/observabilityQueries.ts:77` | `/queries/audits` | 审计日志,随时间无限增长 |
| `src/api/approvals.ts:7` | `/queries/approvals` | 审批命令;`CatchUpApprovalsTab.vue` / `MCatchUp.vue` 消费 |
| `src/api/alertsQuery.ts:22` | `/queries/alerts` | 告警事件,洪峰下量大 |
| `src/api/instance.ts:47` | step-instance | `JobStepInstanceList.vue` 消费,单 job 步骤多时易超 |
| `src/api/workflowQueries.ts:15` | workflow definitions | 大租户 workflow 多 |
| `src/views/file-center/FilePipelineObservability.vue` | pipeline 观测 | 流水实例随跑批累积 |

### 🟡 配置/字典类 — 可接受,暂不动
job-definition / fileChannels / queues / governance / system 等:数据量受租户配置规模限,远 <4000;
端上聚合用于下拉/关联解析,迁移收益低。`operationAudits.ts` 已**主动避开** fetchAllPageItems(注释说明),可参考其服务端分页写法。

## ⚠️ 关键约束:多数端点后端筛选参数不全 → 必须前后端协同,纯前端迁会退化

实查(2026-06-21):这些 `/queries/*` 端点**当前只暴露 `tenantId/pageNo/pageSize`,没有业务筛选参数**。
而前端是**端上全量拉取 + 端上多维筛选**(如 `CatchUpApprovalsTab` 按 status/bizDate/keyword 在
`filtered` computed 里筛)。

| 端点 | 后端现有 query 参数 | 前端端上筛选维度 | 能否纯前端迁 |
|---|---|---|---|
| `/queries/catch-up-approvals` | tenantId/jobCode/requestId/**bizDate**/**keyword**/cursor/pageNo/pageSize | keyword / status / bizDate | ✅ **后端已补**(BE PR #602:bizDate 精确 + keyword 跨列模糊;status 维度后端恒 ACCEPTED、前端 enum 退化 no-op,无需后端参数)→ 待 BE 合 main 后纯前端迁 |
| `/queries/approvals` | tenantId/approvalNo/approvalType/actionType/approvalStatus/**requesterId**/**keyword**/pageNo/pageSize | status / type / keyword / requesterId | ✅ **后端已补**(BE PR #605:requesterId 精确 + keyword 跨 approvalNo/requesterId/targetType/targetId 模糊;status→approvalStatus、type→approvalType 早已支持)→ 待 BE 合 main 后纯前端迁 |
| `/queries/audits` | tenantId/operationType/operationResult/operatorId/fileId/traceId/startTime/endTime/pageNo/pageSize | 同左(全部) | ✅ **后端早已完整支持**(service+mapper+OpenAPI 都齐),**无需后端改动**,前端可直接迁 |
| `/queries/alerts` | tenantId/severity/status/alertType/traceId | severity/alertType/traceId(端上) + status→acknowledged + 时间范围 | ⚠️ **前后端契约错位**:前端发 `acknowledged`/`startDate`/`endDate` 后端 DTO 没有(实为 `status`、无时间参);traceId 后端精确 vs 前端子串。需单独契约对齐 PR,**不是简单补参** |

> **进度(2026-06-21)**:
> - **catch-up-approvals**:后端筛选参数补齐(file-batch-system PR #602:DTO+Query+mapper+OpenAPI+IT),服务端筛选+分页样板端点。
> - **approvals**:后端补 `requesterId`+`keyword`(file-batch-system PR #605:DTO+Query+mapper+OpenAPI+IT;并补录该端点 OpenAPI 既有漂移)。
> - **audits**:核查后确认后端 service+mapper+OpenAPI **已完整支持**前端全部筛选维度,**零后端改动**,可直接前端迁。
> - **alerts**:前后端契约错位(见上表),需先做契约对齐(后端补 `acknowledged`/时间范围 或 前端改用 `status`/对齐 traceId 匹配语义),再迁分页。本批未动。
>
> **迁移动作**(每个 ✅ 端点)**:待对应 BE PR 合入 `../file-batch-system` main → 前端 `npm run gen:api` 刷新类型 → 对应页面(`CatchUpApprovalsTab` / `GeneralApprovalsTab` / `AuditList` / 移动端对应)去掉 `fetchAllPageItems`,把端上 `filtered` 改成把筛选项作为 query 参数传后端 + ProTable 服务端 total/page。

**若纯前端改服务端分页而后端筛选参数不补**:keyword/status/bizDate 筛选会退化成"只在当前页生效"
(用户筛不到下一页的匹配项)→ **比现在的 4000 截断更糟**。所以这是**前后端协同任务**,不是纯前端 fix。

**正确顺序**:① 后端给 `/queries/*` 补业务筛选 query 参数(catch-up: status/bizDate/keyword;
audits/alerts 同理)→ ② 前端把端上 `filtered` 逻辑改成传参 → ③ ProTable 服务端 total/page。

## 迁移方向

1. **后端**:确认这些 `/queries/*` 端点支持服务端筛选参数(jobCode/status/时间范围等);缺的补。
2. **前端**:🔴 类页面改成 `ProTable` 服务端分页(`v-model:page` + 服务端 total),不再 `fetchAllPageItems`。
   参考已迁移的**文件列表**(file-center,已服务端分页)+ `operationAudits.ts`。
3. **过渡兜底**:迁移前,至少把 `fetchAllPageItems` 截断从静默 warn 改成**给用户可见提示**("仅显示前 4000 条,请用筛选缩小范围"),避免"看着全其实不全"。

## 优先级
- P1:audits / approvals / alerts(运行态、增长最快、最容易超 4000)
- P2:step-instance / workflow / pipeline 观测
- P3:截断用户可见提示(过渡兜底,可先做,成本低)

## 不做
配置/字典类(🟡)不迁——量小、收益低,符合"不为指标重构"原则。

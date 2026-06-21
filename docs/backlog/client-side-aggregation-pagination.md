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
| `/queries/catch-up-approvals` | tenantId/pageNo/pageSize | keyword / requestStatus / bizDate | ❌ 后端缺 3 个筛选参数 |
| `/queries/approvals` | tenantId/pageNo/pageSize | (视消费方) | ❌ 同上 |
| `/queries/audits` `/queries/alerts` | tenantId/pageNo/pageSize | 时间/类型等 | ❌ 需核后端 |

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

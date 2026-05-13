# 2026-05-13 · IA 审计与 Run-centric 详情页改造

> 用户反馈:"前端页面好多好乱"。本文对照行业成熟批量/调度产品(Airflow / Dagster /
> Prefect / DolphinScheduler),审计当前信息架构(IA),并给出已落地的
> Run-centric 详情页改造记录与后续 IA 重排建议。

## 1. 现状

8 组 38 项。

| 组 | 项数 | 内容 |
|---|---|---|
| 工作台 | 4 | 控制面板 / 审批中心 / 报表中心 / 自助服务 |
| 定义与编排 | 4 | 作业定义 / 工作流定义 / 流水线定义 / 编排设计器 |
| 执行与监控 | 4 | 作业运行 / 作业步骤 / 工作流运行 / 调度快照 |
| 文件中心 | 4 | 文件列表 / 文件模板 / 到达组治理 / 流水线观测 |
| 配置管理 | 4 | 发布管理 / 变更与同步 / 标签管理 / 配置批量导入 |
| **观测与查询** | **8** | 告警 / 告警路由 / 审计日志 / Outbox / 通知与投递 / Trace 诊断 / 综合查询 / 事件目录 |
| 运行配置 | 5 | Worker / 触发器 / 批次日与窗口 / 队列与窗口 / 租户配额 |
| 系统管理 | 6 | 租户实例 / 登录账户 / 系统参数 / API Key / AI 助手 / 运维诊断 |

## 2. 行业对照

| 产品 | 顶级 | 总叶子 | 核心模式 |
|---|---|---|---|
| Airflow | 5(DAGs / Datasets / Browse / Admin / Security) | ~25 | DAG-centric,详情页一页全 |
| Dagster | 4(Overview / Runs / Assets / Deployment) | ~18 | Asset-centric + Run 全局列表 |
| Prefect | 5(Dashboard / Runs / Flows / Deployments / Blocks) | ~20 | Run 全局列表是首页 |
| DolphinScheduler | 6(项目 / 资源 / 数据源 / 监控 / 安全 / 数据质量) | ~30 | 项目隔离,运行混在项目内 |
| **当前 batch-console** | **8** | **38** | **按 feature 拆分,无 Run 全局入口** |

## 3. 主要病灶

| # | 病灶 | 证据 | 行业做法 | 建议 |
|---|---|---|---|---|
| 1 | 没有"全局 Runs"入口 | 作业运行 / 工作流运行 / 文件流水线观测 在 3 个不同组 | Dagster / Prefect 都把 Runs 做成顶级 tab | 新增顶级"Runs",聚合 3 个实体的近 24h 运行 |
| 2 | 观测组 8 项过载 | 告警 / 路由 / 审计 / Outbox / 通知 / Trace / 查询 / 事件 混堆 | Airflow 拆成 Browse(用户视角) + Admin(基础设施) | Outbox / 通知 / 事件目录 → 移入基础设施;告警/路由 自成一组;Trace 提到顶级或合入 Runs |
| 3 | 定义 ↔ 执行 mental model 分裂 | 作业定义在 group2,作业运行在 group3 | Airflow DAG detail 页内含 Grid / Graph / Gantt / Code | 列表行点击进 detail,detail 内 tabs 含 Runs / Code / Config |
| 4 | "综合查询"是元能力却埋在二级 | observability/queries 是跨实体搜索 | Linear / Notion 都用 ⌘K 全局 palette | 改成顶部 ⌘K 触发,从 sidebar 移除 |
| 5 | 运行配置 vs 系统管理边界模糊 | Worker 在"运行配置",租户在"系统管理",都是基础设施 | Airflow 全归 Admin | 合并成"基础设施" |
| 6 | 3 套定义并行(作业/工作流/流水线) | 三个独立列表页,新用户难区分 | Dagster 统一到 asset,Prefect 统一到 flow | 短期:加 type filter + 共享列表组件;长期:考虑收敛实体模型 |
| 7 | "自助服务"不该是顶级 | 是面向终端用户的合集 | — | 移入"工作台"作为二级 tab,或独立 /portal 路由 |
| 8 | 报表中心位置低 | 在工作台第三 | Dagster 有 Insights 顶级 | 留在工作台可以,但首页 dashboard 应包含主要图表 |

## 4. 建议的新 IA(5 组 ~24 项)

| 组 | 项 |
|---|---|
| 工作台 | 控制面板 · 审批中心 · 报表 · 自助服务 |
| **Runs**(新) | 全部运行(跨 job/workflow/pipeline) · 调度快照 · Trace 诊断 |
| 定义 | 作业 · 工作流 · 流水线 · 设计器(快捷) |
| 文件中心 | 文件 · 模板 · 到达组 · 流水线观测 |
| 告警与配置 | 告警 · 告警路由 · 发布 · 变更 · 标签 · 批量导入 · 事件目录 |
| 基础设施(合并) | Worker · 触发器 · 批次日 · 队列 · 配额 · 租户 · 账户 · API Key · 参数 · Outbox · 通知 · 审计 · 运维诊断 · AI 助手 |

⌘K 全局搜索取代"综合查询"。

## 5. 已落地:Run-centric 详情页改造

**Commit**: `732cb79` (`feat(monitor): JobInstance 详情页改为 Dagster 风 tabs`)
**改造文件**: `src/views/monitor/JobInstanceDetail.vue` + i18n

### 改造前

平铺单页:metric cards → 关联引用 → 时间与 SLA → 参数/结果 → 一排操作按钮。
查"步骤"要跳 `/monitor/job-instances/:id/partitions`,查"历史运行"要跳列表筛 jobCode。

### 改造后

对照 Dagster Run 页 / Airflow DAG detail 的"一页全":

- 顶部 6 个 metric card 保留(at-a-glance)
- **三 tab**:
  - **概览** — 关联引用 + 时间与 SLA + 参数/结果 + 操作按钮
  - **步骤**(新)— inline 拉 `partitions`,保留"在独立页打开"deeplink
  - **最近运行**(新)— 同 jobCode 最近 10 次,直接看趋势 / 识别相邻失败
- tab 内容懒加载(`:lazy`),切到才请求
- 切换 instance 时清空 steps / recent 缓存,避免脏数据

### 收益

oncall 排查典型路径从 4 跳压到 1 页:

```
旧:详情 → 跳分片 → 回退 → 跳列表筛 jobCode  (4 次导航)
新:详情(默认 overview tab) → 点 "步骤" tab → 点 "最近运行" tab  (0 次导航)
```

## 6. 后续(按优先级排序)

| P | 任务 | 范围 | 风险 |
|---|---|---|---|
| P0 | 新增顶级"Runs"入口(病灶 #1) | 加一个 `/runs` 聚合页 + sidebar 顶级项;复用 JobInstanceList / WorkflowRunList 的 row | 低,加法不破坏现有 |
| P1 | 观测组拆分(病灶 #2) | 调 `src/constants/navigation.ts` 分组;无新代码 | 低,纯重排 |
| P1 | 综合查询 → ⌘K palette(病灶 #4) | 新增全局 CommandPalette 组件,挂载到 LayoutHeader;移除 sidebar 项 | 中,需键盘交互 + 跨实体路由 |
| P2 | 作业/工作流详情 Run-centric 化(病灶 #3) | 仿照 JobInstanceDetail 改造 `JobDefinitionDetail` / `WorkflowDefinitionDetail`,加 "Runs" tab | 中,需复用现有列表筛选 |
| P2 | 运行配置 + 系统管理 合并(病灶 #5) | 调 navigation.ts;改组名 | 低 |
| P3 | 3 套定义收敛(病灶 #6) | 实体模型决策,涉及 BE | 高,需产品/架构对齐 |

## 7. 参考

- Apache Airflow UI — <https://airflow.apache.org/docs/apache-airflow/stable/ui.html>
- Dagster UI — <https://docs.dagster.io/concepts/dagit/dagit>
- Prefect Cloud — <https://docs.prefect.io/latest/concepts/runs/>
- 历史审计:`docs/ui/2026-04-22-console-ui-ux-audit.md`

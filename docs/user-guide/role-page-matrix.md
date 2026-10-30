# 角色与页面矩阵

> **关注角色**：全部角色、账号管理员、验收人员
> **用途**：确认四类正式角色在当前前端应看到的主要页面
> **判定依据**：后端菜单、前端路由和精确 authority 共同取交集

## 图例

- **管理**：可进入页面，并可执行该角色被授权的写操作。
- **只读**：可进入页面，写按钮隐藏或禁用；具体接口仍以后端为准。
- **自助**：只开放面向本人或当前租户的受控操作。
- **查询/导出**：查询或下载已有报表，不表示配置写权限。
- **能力授权**：后端下发对应 capability 后才可进入，不只按角色判断。
- **—**：当前角色不应看到入口；不能据此推断接口不存在。

缩写：`ADMIN` = 平台管理员，`AUDITOR` = 平台审计员，`TENANT_ADMIN` = 租户管理员，`TENANT_USER` = 租户用户。

## 工作台与运行监控

| 页面       | 路由                     | ADMIN | AUDITOR | TENANT_ADMIN | TENANT_USER |
| ---------- | ------------------------ | ----- | ------- | ------------ | ----------- |
| 控制面板   | `/ops/summary`           | 只读  | 只读    | 只读         | 只读        |
| 审批中心   | `/approvals`             | 管理  | —       | 管理         | —           |
| 导出中心   | `/reports`               | 查询/导出 | 查询/导出 | 查询/导出 | 查询/导出 |
| 自助服务   | `/self-service`          | 自助  | —       | 自助         | 自助        |
| 全部运行   | `/runs`                 | 只读  | 只读    | 只读         | 只读        |
| 作业运行   | `/monitor/job-instances` | 管理  | 只读    | 只读         | 只读        |
| 工作流运行 | `/monitor/workflow-runs` | 管理  | 只读    | 只读         | 只读        |
| 综合查询   | `/observability/queries` | 只读  | 只读    | 只读         | 只读        |
| Trace 诊断 | `/observability/trace`   | 只读  | 只读    | 只读         | 只读        |
| 使用统计   | `/observability/usage`   | 只读  | 只读    | 只读         | —           |
| 运维工具   | 顶栏工具抽屉             | 只读  | 只读    | 只读         | 只读        |
| 平台诊断   | `/ops/diagnostic`        | 管理  | —       | —            | —           |

全部运行页提供查询与详情跳转。作业运行的重跑、批量重试／取消、暂停／恢复、分区重试和终止，以及Workflow运行的生命周期控制、跳过与重放申请，仅平台管理员可执行；租户管理员的配置写权限不包含这些运行控制。审批中心保留其独立的审批角色边界。

## 告警、投递与定义

| 页面            | 路由                            | ADMIN | AUDITOR | TENANT_ADMIN | TENANT_USER |
| --------------- | ------------------------------- | ----- | ------- | ------------ | ----------- |
| 告警            | `/observability/alerts`         | 管理  | 只读    | 管理         | 只读        |
| 告警路由        | `/observability/alert-routings` | 管理  | —       | 管理         | —           |
| 通知与投递      | `/system/notifications`         | 管理  | —       | 管理         | —           |
| Outbox          | `/observability/outbox`         | 管理  | —       | 管理         | —           |
| 作业定义        | `/jobs/definitions`             | 管理  | 只读    | 管理         | 只读        |
| 新建作业向导    | `/jobs/definitions/new`         | 管理  | —       | —            | —           |
| 工作流定义      | `/workflow/definitions`         | 管理  | 只读    | 管理         | 只读        |
| Workflow 设计器 | `/workflow/designer`            | 管理  | —       | 管理         | —           |
| 租户配置包      | `/config/tenant-package`        | 管理  | —       | 管理         | —           |

`/jobs/pipelines` 路由已移除；当前从 `/jobs/definitions` 进入作业定义。系统阶段在 Job 详情只读展示；受管单作业 Workflow 设计器也只读。

## 文件与调度治理

| 页面                              | 路由                                           | ADMIN | AUDITOR | TENANT_ADMIN | TENANT_USER |
| --------------------------------- | ---------------------------------------------- | ----- | ------- | ------------ | ----------- |
| 文件列表 | `/files/list` | 管理 | 只读 | 管理 | 只读 |
| 到达组 | `/files/arrival-groups` | 管理 | 只读 | 管理 | 只读 |
| Pipeline 观测 | `/files/pipeline-obs` | 只读 | 只读 | 只读 | 只读 |
| 文件模板 / 文件渠道               | `/files/templates`、`/files/channels`          | 管理  | 只读    | 管理         | —           |
| Worker / Trigger                  | `/workers/management`、`/system/triggers`      | 管理  | —       | 管理         | —           |
| 调度快照 | `/scheduler/snapshot` | 管理 | 只读 | 只读 | 只读 |
| 批次日与窗口 | `/scheduler/batch-days` 及详情 | 管理 | 只读 | 查询/受控补登 | 只读 |
| 批次日重放                        | `/ops/batch-day-replay`                        | 管理  | —       | 管理         | —           |
| 容量画像                          | `/ops/capacity-profile`                        | 只读  | 只读    | 只读         | 只读        |
| 业务日历                          | `/governance/calendars`                        | 管理  | —       | 只读         | —           |
| 批次窗口 / 资源队列               | `/governance/windows`、`/governance/queues`    | 管理  | —       | —            | —           |
| 配额 / 自定义任务 | 对应治理页 | 管理 | — | 管理 | — |
| Worker 指纹 | `/ops/worker-fingerprints` | 只读 | — | 只读 | — |
| 分片目录 / 租户放置               | `/ops/shard-catalog`、`/ops/tenant-placements` | 管理  | —       | —            | —           |

文件列表的管理动作包括重新派发和归档，到达组包括人工确认。批次日详情仅在条目为 `CLOSED_DAY_REJECTED`、策略为 `AUTO` 或 `MANUAL_APPROVAL` 且具配置写权限时提供受控补登；调度器全局暂停/恢复和页头补登仍只向管理员开放。

## 系统管理

| 页面                  | 路由                                     | ADMIN | AUDITOR | TENANT_ADMIN | TENANT_USER |
| --------------------- | ---------------------------------------- | ----- | ------- | ------------ | ----------- |
| 租户管理              | `/system/tenants`                        | 管理  | —       | 只读         | —           |
| 登录账户              | `/system/user-accounts`                  | 管理  | —       | 本租户管理   | —           |
| 我的账户              | `/system/me`                             | 自助  | 自助    | 自助         | 自助        |
| 权限自查              | `/system/users`                          | 只读  | 只读    | 只读         | 只读        |
| 配置发布 | `/config/releases` | 管理 | 只读 | 只读 | — |
| 变更 / Secret / 同步 | `/config/management` | 按接口授权 | 按接口授权 | 按接口授权 | — |
| 文件审计 / 操作审计   | `/observability/audits`、`/observability/operation-audits` | 只读 | 只读 | 只读 | — |
| 事件目录              | `/system/event-catalog`                  | 只读  | 只读    | 只读         | 只读        |
| 标签管理              | `/system/tags`                           | 管理  | —       | 管理         | —           |
| API Key               | `/system/api-keys`                       | 自助  | —       | 自助         | 自助        |
| AI 助手 | `/system/ai-chat` | 能力授权 | 能力授权 | 能力授权 | 能力授权 |
| 系统参数 | `/system/parameters` | 管理 | — | — | — |
| 原子节点配置中心 | `/system/atomic-task-types` | 管理（当前租户预设） | — | 管理（本租户预设） | — |

AI 页面要求 `AI_ASSISTANT_USE`；后端默认允许 `ROLE_ADMIN`、`ROLE_AUDITOR`，也可按配置授权指定用户或角色。功能关闭或未下发能力时均不可进入，不能用默认角色表代替当前 capability。

## 验收方法

每类角色至少执行一次以下检查：

1. 登录后右上角显示正式角色名称，而不是 `ADMIN / OPERATOR / VIEWER` 能力档。
2. 打开“权限自查”，确认 authority、当前租户和实际可见页面一致。
3. 检查侧边栏、全局搜索和直接访问 URL 三种入口结果一致。
4. 对只读页面确认写按钮不可用；对管理页面执行一条可回滚的受控操作。
5. 角色或租户变化后重新登录，确认菜单和接口权限同步刷新。

配置发布页面的创建、发布与回滚入口仅向 ADMIN 展示。配置管理的“同步”和“同步日志”页签仅 ADMIN 可见，其他角色直接访问对应 tab 参数时回到可读页签；导出、预览和导入处理函数也复核权限，导入受维护写冻结限制，并在确认后复核租户与权限。配置变更日志及 Secret 属于独立接口授权，不由同步页签权限代替。

本矩阵描述当前产品入口，不替代后端接口授权。若矩阵、后端菜单和 Controller 不一致，应以后端 Controller 为安全边界，并修正文档与菜单配置。

批次日治理抽屉的补扫预览与历史缺口仅向管理员、审计员和租户管理员开放；冻结/放行/跳过/重开/关闭/空日结算及自动补扫暂停/恢复只向管理员开放。普通租户用户仍可读窗口，不会获得治理写权限。审计员属于可显式指定租户的全局只读角色；租户管理员和普通租户用户受自身租户约束。

调度快照内的依赖等待面板仅向 ADMIN、AUDITOR、TENANT_ADMIN 展示；跨日历等待查询对这三类角色只读，状态筛选仅提供接口支持的 WAITING、OPENED、SKIPPED，并显示 SLA 截止与超时提醒时间。RELEASE/SKIP 决策仅 ADMIN 可提交并记录原因。作业依赖等待对所有角色均只读，显示超时提醒时间，TENANT_USER 不显示该子面板。

## Outbox 运维写权限

Outbox 统计/记录查询保留读取角色；清理与人工重投仅平台管理员、租户管理员可执行，租户管理员受自身租户限制，审计员只读。可人工重投的状态为 FAILED/GIVE_UP；按实际重置数显示结果，记录已被并发发布时不会提示重投成功。确认或排队期间切换租户/失去写权限会停止后续请求。

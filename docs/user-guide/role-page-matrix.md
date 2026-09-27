# 角色与页面矩阵

> **关注角色**：全部角色、账号管理员、验收人员
> **用途**：确认四类正式角色在当前前端应看到的主要页面
> **判定依据**：后端菜单、前端路由和精确 authority 共同取交集

## 图例

- **管理**：可进入页面，并可执行该角色被授权的写操作。
- **只读**：可进入页面，写按钮隐藏或禁用；具体接口仍以后端为准。
- **自助**：只开放面向本人或当前租户的受控操作。
- **—**：当前角色不应看到入口；不能据此推断接口不存在。

缩写：`ADMIN` = 平台管理员，`AUDITOR` = 平台审计员，`TENANT_ADMIN` = 租户管理员，`TENANT_USER` = 租户用户。

## 工作台与运行监控

| 页面       | 路由                     | ADMIN | AUDITOR | TENANT_ADMIN | TENANT_USER |
| ---------- | ------------------------ | ----- | ------- | ------------ | ----------- |
| 控制面板   | `/ops/summary`           | 只读  | 只读    | 只读         | 只读        |
| 审批中心   | `/approvals`             | 管理  | —       | 管理         | —           |
| 导出中心   | `/reports`               | 管理  | 只读    | 管理         | 只读        |
| 自助服务   | `/self-service`          | 自助  | —       | 自助         | 自助        |
| 作业运行   | `/monitor/job-instances` | 管理  | 只读    | 管理         | 只读        |
| 工作流运行 | `/monitor/workflow-runs` | 管理  | 只读    | 管理         | 只读        |
| 综合查询   | `/observability/queries` | 只读  | 只读    | 只读         | 只读        |
| Trace 诊断 | `/observability/trace`   | 只读  | 只读    | 只读         | 只读        |
| 运维工具   | 顶栏工具抽屉             | 只读  | 只读    | 只读         | 只读        |
| 平台诊断   | `/ops/diagnostic`        | 管理  | —       | —            | —           |

## 告警、投递与定义

| 页面            | 路由                            | ADMIN | AUDITOR | TENANT_ADMIN | TENANT_USER |
| --------------- | ------------------------------- | ----- | ------- | ------------ | ----------- |
| 告警            | `/observability/alerts`         | 管理  | 只读    | 管理         | 只读        |
| 告警路由        | `/observability/alert-routings` | 管理  | —       | 管理         | —           |
| 通知与投递      | `/system/notifications`         | 管理  | —       | 管理         | —           |
| Outbox          | `/observability/outbox`         | 管理  | —       | 管理         | —           |
| 作业定义        | `/jobs/definitions`             | 管理  | 只读    | 管理         | 只读        |
| 新建作业向导    | `/jobs/definitions/new`         | 管理  | —       | 管理         | —           |
| Pipeline 定义   | `/jobs/pipelines`               | 管理  | 只读    | 管理         | 只读        |
| 工作流定义      | `/workflow/definitions`         | 管理  | 只读    | 管理         | 只读        |
| Workflow 设计器 | `/workflow/designer`            | 管理  | —       | 管理         | —           |
| 租户配置包      | `/config/tenant-package`        | 管理  | —       | 管理         | —           |

## 文件与调度治理

| 页面                              | 路由                                           | ADMIN | AUDITOR | TENANT_ADMIN | TENANT_USER |
| --------------------------------- | ---------------------------------------------- | ----- | ------- | ------------ | ----------- |
| 文件列表 / 到达组 / Pipeline 观测 | `/files/*` 查询页                              | 只读  | 只读    | 只读         | 只读        |
| 文件模板 / 文件渠道               | `/files/templates`                             | 管理  | 只读    | 管理         | —           |
| Worker / Trigger                  | `/workers/management`、`/system/triggers`      | 管理  | —       | 管理         | —           |
| 调度快照 / 批次日                 | `/scheduler/*`                                 | 管理  | 只读    | 只读         | 只读        |
| 批次日重放                        | `/ops/batch-day-replay`                        | 管理  | —       | 管理         | —           |
| 容量画像                          | `/ops/capacity-profile`                        | 只读  | 只读    | 只读         | 只读        |
| 业务日历                          | `/governance/calendars`                        | 管理  | —       | 只读         | —           |
| 批次窗口 / 资源队列               | `/governance/windows`、`/governance/queues`    | 管理  | —       | —            | —           |
| 配额 / 自定义任务 / Worker 指纹   | 对应治理页                                     | 管理  | —       | 管理         | —           |
| 分片目录 / 租户放置               | `/ops/shard-catalog`、`/ops/tenant-placements` | 管理  | —       | —            | —           |

## 系统管理

| 页面                  | 路由                                     | ADMIN | AUDITOR | TENANT_ADMIN | TENANT_USER |
| --------------------- | ---------------------------------------- | ----- | ------- | ------------ | ----------- |
| 租户管理              | `/system/tenants`                        | 管理  | —       | 受限管理     | —           |
| 登录账户              | `/system/user-accounts`                  | 管理  | —       | 本租户管理   | —           |
| 我的账户              | `/system/me`                             | 自助  | 自助    | 自助         | 自助        |
| 权限自查              | `/system/users`                          | 只读  | 只读    | 只读         | 只读        |
| 配置发布 / 变更与同步 | `/config/releases`、`/config/management` | 管理  | 只读    | 受限管理     | —           |
| 文件审计 / 操作审计   | `/observability/audits`                  | 只读  | 只读    | 只读         | —           |
| 事件目录              | `/system/event-catalog`                  | 只读  | 只读    | 只读         | 只读        |
| 标签管理              | `/system/tags`                           | 管理  | —       | 管理         | —           |
| API Key               | `/system/api-keys`                       | 自助  | —       | 自助         | 自助        |
| AI 助手 / 系统参数    | 对应系统页                               | 管理  | —       | —            | —           |

## 验收方法

每类角色至少执行一次以下检查：

1. 登录后右上角显示正式角色名称，而不是 `ADMIN / OPERATOR / VIEWER` 能力档。
2. 打开“权限自查”，确认 authority、当前租户和实际可见页面一致。
3. 检查侧边栏、全局搜索和直接访问 URL 三种入口结果一致。
4. 对只读页面确认写按钮不可用；对管理页面执行一条可回滚的受控操作。
5. 角色或租户变化后重新登录，确认菜单和接口权限同步刷新。

本矩阵描述当前产品入口，不替代后端接口授权。若矩阵、后端菜单和 Controller 不一致，应以后端 Controller 为安全边界，并修正文档与菜单配置。

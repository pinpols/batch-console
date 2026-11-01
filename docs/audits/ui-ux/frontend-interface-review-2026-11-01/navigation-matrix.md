# 菜单与四角色静态矩阵

来源：前端`navigation.ts`、路由和permission store，后端默认`menu.yml`与`ConsoleMenuRegistry`。角色仅用于推导默认菜单可见性，**未以四套真实账户登录验收**。外置菜单覆盖、动态capability和具体写API权限不由本表替代。

`侧栏`=本地允许且默认后端菜单允许；`搜索`=同条件、但hidden不进入侧栏；`—`=当前默认不可见。AI另按实际capability授权，不计入下列固定数量。维护设置复用管理员系统参数allowlist。

| 角色 | 侧栏项 | 菜单搜索项（含侧栏） |
| --- | ---: | ---: |
| ADMIN | 28 | 55 |
| AUDITOR | 18 | 27 |
| TENANT_ADMIN | 27 | 48 |
| TENANT_USER | 14 | 22 |

七组共56项：28项侧栏、28项hidden。AI的实际能力按`AI_ASSISTANT_USE`判断，可能增加一项搜索结果；默认后端角色白名单为ADMIN/AUDITOR。下表只覆盖**menu来源**，最近访问/快捷直达/实体来源的偏差见审查N01/N02。

| 分组 | 路径 | ADMIN | AUDITOR | TENANT_ADMIN | TENANT_USER |
| --- | --- | --- | --- | --- | --- |
| workspace | `/ops/summary` | 侧栏 | 侧栏 | 侧栏 | 侧栏 |
| workspace | `/approvals` | 侧栏 | — | 侧栏 | — |
| workspace | `/reports` | 侧栏 | 侧栏 | 侧栏 | 侧栏 |
| workspace | `/self-service` | 侧栏 | — | 侧栏 | 侧栏 |
| monitor | `/monitor/job-instances` | 侧栏 | 侧栏 | 侧栏 | 侧栏 |
| monitor | `/monitor/job-steps` | 搜索 | 搜索 | 搜索 | 搜索 |
| monitor | `/monitor/workflow-runs` | 侧栏 | 侧栏 | 侧栏 | 侧栏 |
| monitor | `/runs` | 搜索 | 搜索 | 搜索 | 搜索 |
| monitor | `/observability/queries` | 侧栏 | 侧栏 | 侧栏 | 侧栏 |
| monitor | `/observability/trace` | 侧栏 | 侧栏 | 侧栏 | 侧栏 |
| monitor | `/observability/usage` | 侧栏 | 侧栏 | 侧栏 | — |
| monitor | `/ops/diagnostic` | 搜索 | — | — | — |
| monitor | `/observability/lineage` | 搜索 | 搜索 | 搜索 | 搜索 |
| alerting | `/observability/alerts` | 侧栏 | 侧栏 | 侧栏 | 侧栏 |
| alerting | `/observability/job-monitoring-policies` | 侧栏 | — | 侧栏 | — |
| alerting | `/observability/alert-routings` | 搜索 | — | 搜索 | — |
| alerting | `/system/notifications` | 侧栏 | — | 侧栏 | — |
| alerting | `/observability/outbox` | 侧栏 | — | 侧栏 | — |
| definitions | `/jobs/definitions` | 侧栏 | 侧栏 | 侧栏 | 侧栏 |
| definitions | `/workflow/definitions` | 侧栏 | 侧栏 | 侧栏 | 侧栏 |
| definitions | `/workflow/designer` | 搜索 | — | 搜索 | — |
| definitions | `/config/tenant-package` | 搜索 | — | 搜索 | — |
| files | `/files/list` | 侧栏 | 侧栏 | 侧栏 | 侧栏 |
| files | `/files/arrival-groups` | 搜索 | 搜索 | 搜索 | 搜索 |
| files | `/files/pipeline-obs` | 搜索 | 搜索 | 搜索 | 搜索 |
| files | `/files/templates` | 侧栏 | 侧栏 | 侧栏 | — |
| files | `/files/channels` | 搜索 | 搜索 | 搜索 | — |
| scheduling | `/workers/management` | 侧栏 | — | 侧栏 | — |
| scheduling | `/system/triggers` | 侧栏 | — | 侧栏 | — |
| scheduling | `/scheduler/snapshot` | 侧栏 | 侧栏 | 侧栏 | 侧栏 |
| scheduling | `/scheduler/batch-days` | 侧栏 | 侧栏 | 侧栏 | 侧栏 |
| scheduling | `/ops/batch-day-replay` | 搜索 | — | 搜索 | — |
| scheduling | `/ops/capacity-profile` | 搜索 | 搜索 | 搜索 | 搜索 |
| scheduling | `/ops/asset-freshness` | 搜索 | — | 搜索 | — |
| scheduling | `/governance/calendars` | 搜索 | — | 搜索 | — |
| scheduling | `/governance/windows` | 搜索 | — | — | — |
| scheduling | `/governance/quota` | 搜索 | — | 搜索 | — |
| scheduling | `/governance/queues` | 搜索 | — | — | — |
| scheduling | `/ops/custom-task-types` | 搜索 | — | 搜索 | — |
| scheduling | `/ops/worker-fingerprints` | 搜索 | — | 搜索 | — |
| scheduling | `/ops/shard-catalog` | 搜索 | — | — | — |
| scheduling | `/ops/tenant-placements` | 搜索 | — | — | — |
| system | `/system/tenants` | 侧栏 | — | 侧栏 | — |
| system | `/system/user-accounts` | 侧栏 | — | 侧栏 | — |
| system | `/system/users` | 侧栏 | 侧栏 | 侧栏 | 侧栏 |
| system | `/config/releases` | 侧栏 | 侧栏 | 侧栏 | — |
| system | `/config/management` | 侧栏 | 侧栏 | 侧栏 | — |
| system | `/observability/audits` | 侧栏 | 侧栏 | 侧栏 | — |
| system | `/observability/operation-audits` | 搜索 | 搜索 | 搜索 | — |
| system | `/system/event-catalog` | 搜索 | 搜索 | 搜索 | 搜索 |
| system | `/system/tags` | 搜索 | — | 搜索 | — |
| system | `/system/ai-chat` | 能力授权 | 能力授权 | 能力授权 | 能力授权 |
| system | `/system/api-keys` | 搜索 | — | 搜索 | 搜索 |
| system | `/system/parameters` | 搜索 | — | — | — |
| system | `/system/maintenance` | 侧栏 | — | — | — |
| system | `/system/atomic-task-types` | 搜索 | — | 搜索 | — |

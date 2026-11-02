# 导航与页面分组审查（2026-11-02）

状态：审查记录；用户授权后的菜单、快捷入口和深链调整已在本地实施并进行组件级验证。基于前端 `fix/status-filters-worker-loading` 工作区和配对后端当日代码核查；不代表四角色运行态验收。

## 范围

调整前盘点 `src/constants/navigation.ts` 中 7 个导航组、56 个登记入口（其中 28 个侧栏隐藏），检查路由、菜单权限、搜索入口，以及 18 个使用 `el-tabs` 的桌面组件：WorkerManagement、FileTemplateList、FilePipelineObservability、QueueConfig、JobDefinitionDetail、JobInstanceDetail、WorkflowDefinitionList、EventCatalog、LineageEvidence、ObservabilityQueryTabs、OpsSummary、DependencyWaitPanel、AiChat、AtomicTaskTypeCenter、ConfigManagement、NotificationManagement、TagManagement、TenantCopyConfigDialog；另看审批中心、Outbox 和作业配置快捷操作。盘点和针对性源码核对不等于每个动作均已实测。

## 发现与建议

| 项目 | 依据及影响 | 建议 |
| --- | --- | --- |
| Worker 与文件渠道并列 | `WorkerManagement.vue` 的渠道页展示当前租户的渠道配置，未展示与具体 Worker 的绑定或运行状态；文件中心 `FileTemplateList.vue` 维护相同配置。两者字段和操作并不完全相同，前者还有只读详情。 | 渠道配置以文件中心为主要入口；Worker 详情仅在有实际关联或运行状态时展示相应信息。调整前保留原有只读能力并核验各角色可达性：`/queries/file-channels` 与管理接口 `/file-channels` 的角色限制不同，不能直接替换接口或跳转。 |
| 作业详情快捷操作与权限不一致 | `JobDefinitionDetail.vue` 使用 `canActOnJob` 统一控制日历、窗口、队列的入口；租户管理员可满足此条件，但窗口和队列路由要求平台管理员，日历与窗口新建接口的后端写权限亦为平台管理员。`JobConfigBasicForm.vue` 中的快捷新建也需按同一权限核查。 | 根据各目标路由和后端操作分别控制入口，保留租户管理员可使用的业务日历读取；对四角色及直达入口做运行验证。 |
| 旧配置同步入口丢失目标 | `router/index.ts` 将 `/config/sync` 和 `/config/change-logs` 都重定向至 `/config/management`；`ConfigManagement.vue` 没有指定 tab 时默认变更日志。 | 为旧同步入口保留同步 tab 语义，为旧变更记录入口指向日志，并保留原有 query；同步 tab 仍受现有角色控制。 |
| 队列、窗口和日历入口 | 三个资源使用独立路由和不同权限，侧栏隐藏，主要依靠搜索、详情快捷入口及页内切换，发现成本较高。`QueueConfig.vue` 使用 `v-show` 的 Tab 曾列为候选风险；真实 Element Plus 的 jsdom 浅挂载测试中，三种模式初始显示及互切均只显示当前面板，未复现重复显示。 | 改善各角色可达入口，保留三种资源和权限；以上测试未覆盖真实浏览器、API 和角色。 |

## 不建议仅因名称相近合并

审批中心的普通审批与补跑审批围绕同一处理任务；通知渠道、订阅、Webhook、路由模拟和投递记录属于通知链的不同阶段；作业/工作流定义、运行、步骤是列表与上下文详情。文件审计和操作审计的数据源不同；流水线投递与渠道回执也不是同一接口。`/logs` 已重定向到综合查询，不能按旧路径当作独立可见菜单重复计数。

## 验证边界

审查基于源码、路由和后端权限定义；后续本地实现了渠道入口分流、资源入口可发现性、作业快捷入口权限及旧链接定位，并以组件测试覆盖模拟角色和动态菜单。窗口与日历路由原有队列菜单兼容回退仍保留，不能将其描述为严格的逐路径菜单授权。未覆盖真实账号的四角色浏览器验收或真实多租户切换；后端授权策略未修改。

# 全路由页面交互初筛（整改前快照）

基于整改前 `src/router/index.ts` 的 TypeScript AST 递归枚举组件叶路由；redirect/布局不当作页面。共83条组件路由、80个Vue文件：桌面业务66条/63文件、移动12条/12文件、登录及维护/文档不可用/初始化/404共5条/5文件。共享文件包括文件模板/渠道与队列/窗口/日历。

计数为Vue模板AST中的`el-table`、`ProTable`、原生`table`及`GenericRowsTable`实例，不计`el-table-column`；包含抽屉/弹窗/非激活页签，不能解释为同时出现在首屏。桌面业务48/66条路由直接含表格；沿显式Vue子组件导入关系追到表格为56/66，后者包含详情/诊断/编辑器子面板，仅作线索。自动导入、动态render和服务端schema不保证被静态图完全捕获。

整改后新增 `/m/workflow/run/:id` 运行页，使用冻结快照和实时推送；移动定义页保留 `/m/workflow/:id`，旧链接的 `runId` 会转至运行页。移动首页现已增加每日进度摘要。下表保留整改前逐项判断，最新实施状态见[审查记录](./README.md#2026-11-01-整改实施与当前状态)。

**所有行均为静态初筛，业务页真实浏览器巡检未完成**：共享后端18080本轮请求连接后超时。重点建议见[审查结论](./README.md#页面交互建议)，不是全量实测验收。

| 路由 | 页面源码 | 用户任务 | 当前交互 | 模板直接表格数 | 判断与建议 |
| --- | --- | --- | --- | ---: | --- |
| `/login` | [Login](../../../../src/views/login/Login.vue) | 登录 | 品牌分栏、账号表单 | 0 | 保留；本轮统一品牌 |
| `/ops/summary` | [OpsSummary](../../../../src/views/ops/OpsSummary.vue) | 租户运行总览 | 每日总进度、KPI、趋势/分布页签 | 0 | 保留；优先异常到运行详情的钻取 |
| `/approvals` | [ApprovalList](../../../../src/views/approvals/ApprovalList.vue) | 审批决策 | 双页签、待办表格、详情抽屉 | 0 | 保留清单；详情改影响摘要与决策时间线（U08） |
| `/config/releases` | [ConfigReleaseList](../../../../src/views/config/ConfigReleaseList.vue) | 配置发布与比较 | 版本表格、创建表单、JSON比较 | 1 | 保留清单；结构化差异优先（U09） |
| `/config/tenant-package` | [TenantPackageImportWizard](../../../../src/views/config/TenantPackageImportWizard.vue) | 批量导入 | 上传→校验→应用步骤条、校验表格 | 4 | 保留；错误行表格适合修正与核对 |
| `/reports` | [ReportExportHub](../../../../src/views/reports/ReportExportHub.vue) | 趋势与导出 | KPI、堆叠柱、导出卡片 | 0 | 保留；已有图表，无须改表格 |
| `/ops/custom-task-types` | [CustomTaskTypeList](../../../../src/views/ops/CustomTaskTypeList.vue) | SDK任务类型目录 | ProTable、详情描述、JSON | 1 | 保留表格；低频技术目录 |
| `/ops/worker-fingerprints` | [WorkerFingerprintBoard](../../../../src/views/ops/WorkerFingerprintBoard.vue) | 执行环境一致性核对 | 指标卡、指纹表格 | 1 | 保留；差异项可加突出标识 |
| `/ops/capacity-profile` | [CapacityProfile](../../../../src/views/ops/CapacityProfile.vue) | 容量趋势与排名 | 指标、三类图表、明细表 | 1 | 保留；已有合适图表与明细互补 |
| `/ops/asset-freshness` | [AssetFreshnessPolicies](../../../../src/views/ops/AssetFreshnessPolicies.vue) | 新鲜度策略配置 | 策略表格、编辑表单 | 1 | 保留；可增加时间规则自然语言预览 |
| `/system/atomic-task-types` | [AtomicTaskTypeCenter](../../../../src/views/system/AtomicTaskTypeCenter.vue) | 节点能力与预设配置 | 类型页签、参数/安全门表、动态表单 | 2 | 按任务分组参数与帮助，技术schema留高级区（U10） |
| `/files/list` | [FileList](../../../../src/views/file-center/FileList.vue) | 文件查找、上传与追踪 | 摘要卡、ProTable、详情/上传弹层 | 2 | 保留文件表格；状态串联到现有Pipeline面板 |
| `/files/templates` | [FileTemplateList](../../../../src/views/file-center/FileTemplateList.vue) | 文件模板与渠道配置 | 模板/渠道页签、表格、长编辑表单 | 2 | 保留清单；映射和渠道配置分组，JSON作高级模式（U10） |
| `/files/channels` | [FileTemplateList](../../../../src/views/file-center/FileTemplateList.vue) | 文件模板与渠道配置 | 模板/渠道页签、表格、长编辑表单 | 2 | 保留清单；映射和渠道配置分组，JSON作高级模式（U10） |
| `/files/arrival-groups` | [ArrivalGroupList](../../../../src/views/file-center/ArrivalGroupList.vue) | 文件组到达检查 | 指标卡、到达组表格 | 1 | 保留清单；组内缺失/已到达成员可视化后再确认 |
| `/files/pipeline-obs` | [FilePipelineObservability](../../../../src/views/file-center/FilePipelineObservability.vue) | 文件处理与派发定位 | 实例/步骤/派发/错误表格、选中阶段面板 | 4 | 复用已存在阶段面板，保留历史分页；勿另造重复进度页（U01） |
| `/jobs/definitions` | [JobDefinitionList](../../../../src/views/job/JobDefinitionList.vue) | 管理作业定义 | ProTable、详情抽屉、关联配置表单 | 2 | 保留表格与RowActions；复杂编辑进入专页/向导 |
| `/jobs/definitions/new` | [JobDefinitionWizard](../../../../src/views/job/JobDefinitionWizard.vue) | 打包新建作业 | 步骤条、关联选择、多个JSON录入 | 0 | 常规关联改选择/内嵌创建，JSON移高级路径（U10） |
| `/jobs/definitions/:id` | [JobDefinitionDetail](../../../../src/views/job/JobDefinitionDetail.vue) | 查看定义、关联与历史 | 多页签、描述项、关联表格 | 4 | 保留分区；调度依赖用关系摘要，运行历史留表格 |
| `/workflow/definitions` | [WorkflowDefinitionList](../../../../src/views/workflow/WorkflowDefinitionList.vue) | 管理工作流定义 | 表格、版本/运行/DSL/小图详情 | 3 | 保留列表及DAG预览；复杂编排走现有设计器 |
| `/workflow/viewer/:id` | [WorkflowMermaidViewer](../../../../src/views/workflow/WorkflowMermaidViewer.vue) | 只读流程与执行状态 | Mermaid DAG、节点详情、执行面板 | 0 | 保留DAG；与执行节点选择联动（U01） |
| `/workflow/designer/:id?` | [WorkflowDesigner](../../../../src/views/workflow/designer/WorkflowDesigner.vue) | 编排工作流 | 画布、节点面板、属性检查器 | 0 | 保留；本身不是表格式交互 |
| `/workflow/designer/:id/diff/:fromVersion/:toVersion` | [WorkflowDesignerDiff](../../../../src/views/workflow/designer/diff/WorkflowDesignerDiff.vue) | 比较工作流版本 | 并排差异视图 | 1 | 保留；需补真实大图/长名称浏览器复核 |
| `/runs` | [RunsOverview](../../../../src/views/runs/RunsOverview.vue) | 快速浏览近期运行 | 作业/工作流分段、紧凑运行行 | 0 | 保留入口职责，避免与两类完整运行列表重复扩张 |
| `/monitor/job-instances` | [JobInstanceList](../../../../src/views/monitor/JobInstanceList.vue) | 定位作业运行 | 状态筛选、ProTable、批量动作 | 2 | 保留；行摘要提供当前阶段和阻塞，详情呈现图（U01） |
| `/monitor/job-instances/:id` | [JobInstanceDetail](../../../../src/views/monitor/JobInstanceDetail.vue) | 作业执行定位 | 执行DAG、进度、步骤/心跳/近期运行页签 | 2 | 已有图；强化节点选择→详情联动，收敛重复明细（U01） |
| `/monitor/job-instances/:id/partitions` | [PartitionView](../../../../src/views/monitor/PartitionView.vue) | 分区核查与重试 | 状态筛选、分区表格 | 1 | 保留精确表格；大量分区可补状态概览条，不能推测分母 |
| `/monitor/job-steps` | [JobStepInstanceList](../../../../src/views/monitor/JobStepInstanceList.vue) | 查步骤记录 | 筛选、ProTable | 1 | 保留；低频技术明细从作业详情直达即可 |
| `/monitor/workflow-runs` | [WorkflowRunList](../../../../src/views/monitor/WorkflowRunList.vue) | 定位工作流运行 | 筛选、ProTable | 1 | 保留；当前并行执行/等待位置用真实摘要 |
| `/monitor/workflow-runs/:id` | [WorkflowRunDetail](../../../../src/views/monitor/WorkflowRunDetail.vue) | 流程节点执行定位 | 执行DAG及节点表、另一个节点运行表和展开子表 | 3 | DAG作为主操作面，选中节点侧栏，历史表收详情（U01） |
| `/observability/job-monitoring-policies` | [JobMonitoringPolicies](../../../../src/views/observability/JobMonitoringPolicies.vue) | 作业监控策略 | 策略表格、策略编辑表单 | 1 | 保留清单；规则摘要与可读预览优先 |
| `/observability/alerts` | [AlertList](../../../../src/views/observability/AlertList.vue) | 告警处置 | 严重度/状态筛选、告警条目、批量操作 | 0 | 保留任务清单；按故障聚合建议需数据口径支撑 |
| `/observability/alert-routings` | [AlertRoutingPanel](../../../../src/views/observability/AlertRoutingPanel.vue) | 路由告警接收人 | 规则表格、长规则表单 | 1 | 保留清单；规则→分组→接收人预览更易理解（U09） |
| `/observability/trace` | [TraceDiagnostic](../../../../src/views/observability/TraceDiagnostic.vue) | 跨域因果排查 | 按域折叠的多张命中表 | 1 | 优先串联时间线/关联链，原始命中表放明细（U02） |
| `/observability/lineage` | [LineageEvidence](../../../../src/views/observability/LineageEvidence.vue) | 追溯结果版本与产物 | JSON块、相关实体页签/通用表、就绪描述 | 3 | 优先结果→作业→文件→投递关系图与选择详情（U03） |
| `/observability/audits` | [AuditList](../../../../src/views/observability/AuditList.vue) | 文件审计检索 | 筛选、ProTable、JSON证据 | 1 | 保留表格；追踪关系交Trace/血缘 |
| `/observability/operation-audits` | [OperationAuditList](../../../../src/views/observability/OperationAuditList.vue) | 操作审计检索 | 筛选、ProTable、JSON证据 | 1 | 保留表格；适合排序、筛选及导出 |
| `/observability/usage` | [UsageSummary](../../../../src/views/observability/UsageSummary.vue) | 使用统计比较 | 趋势图、筛选与明细表 | 1 | 保留；图与明细互补 |
| `/observability/outbox` | [OutboxList](../../../../src/views/observability/OutboxList.vue) | 失败投递与重投 | 重试/投递记录、ProTable、详情抽屉 | 2 | 保留处理清单；单条投递尝试可用时间线（U09） |
| `/workers/management` | [WorkerManagement](../../../../src/views/worker/WorkerManagement.vue) | 节点运行与资源处置 | Worker状态卡片/负载条、渠道表、认领任务表 | 2 | 保留现有卡片，不再建议从表格重做；大集群再评估密度 |
| `/workers/my-workers` | [MyWorkers](../../../../src/views/worker/MyWorkers.vue) | 本人Worker查看与操作 | ProTable | 1 | 保留小型资源清单；和Worker管理的角色职责需清晰 |
| `/scheduler/snapshot` | [SchedulerSnapshot](../../../../src/views/scheduler/SchedulerSnapshot.vue) | 调度资源与等待定位 | KPI页签、策略/队列/Worker/历史表、依赖等待面板 | 4 | 等待关系主从联动，队列容量/资源状态摘要优先（U06） |
| `/scheduler/batch-days` | [BatchDayList](../../../../src/views/scheduler/BatchDayList.vue) | 批次日期运行概览 | 月历/表格切换、日摘要、治理抽屉 | 1 | 保留现有月历；不重复开发日历（U04） |
| `/scheduler/batch-days/:bizDate` | [BatchDayWindow](../../../../src/views/scheduler/BatchDayWindow.vue) | 日内执行窗口与补登 | 截止信息、作业表、触发条目表、治理表单 | 2 | 增加日内时轴并联动任务；精确条目表留明细（U04） |
| `/governance/quota` | [QuotaPanel](../../../../src/views/governance/QuotaPanel.vue) | 租户配额配置 | 策略卡片、详情与编辑表单 | 0 | 保留卡片；没有使用量分母时不画利用率 |
| `/governance/queues` | [QueueConfig](../../../../src/views/governance/QueueConfig.vue) | 队列/窗口/业务日历配置 | 路由分区、表格、编辑弹层、节假日抽屉表 | 4 | 队列表格保留；窗口加时轴、日历加月视图（U05） |
| `/governance/windows` | [QueueConfig](../../../../src/views/governance/QueueConfig.vue) | 队列/窗口/业务日历配置 | 路由分区、表格、编辑弹层、节假日抽屉表 | 4 | 队列表格保留；窗口加时轴、日历加月视图（U05） |
| `/governance/calendars` | [QueueConfig](../../../../src/views/governance/QueueConfig.vue) | 队列/窗口/业务日历配置 | 路由分区、表格、编辑弹层、节假日抽屉表 | 4 | 队列表格保留；窗口加时轴、日历加月视图（U05） |
| `/system/tenants` | [TenantList](../../../../src/views/system/TenantList.vue) | 租户管理 | ProTable、创建/批建/初始化/复制弹层 | 1 | 保留资源表格；多步初始化可用现有向导组件 |
| `/system/user-accounts` | [UserAccountList](../../../../src/views/system/UserAccountList.vue) | 登录账号与角色管理 | 状态筛选、账号表、OIDC绑定抽屉 | 1 | 保留；权限作用范围用明确摘要 |
| `/system/users` | [UserRole](../../../../src/views/system/UserRole.vue) | 权限自查 | 身份指标、角色/权限描述 | 0 | 保留；入口更适合个人账户上下文（N09建议） |
| `/system/me` | [MyAccount](../../../../src/views/system/MyAccount.vue) | 个人账户与密码 | 账户描述、密码表单 | 0 | 保留；敏感操作保持独立明确确认 |
| `/system/ai-chat` | [AiChat](../../../../src/views/system/AiChat.vue) | 对话与审计 | 聊天、历史会话、审计ProTable | 1 | 保留按任务分区；审计表不应取代会话交互 |
| `/system/api-keys` | [ApiKeyList](../../../../src/views/system/ApiKeyList.vue) | API Key管理 | 表格、创建表单、一次性秘密显示 | 1 | 保留；勿为视觉改造扩大秘密呈现 |
| `/system/triggers` | [TriggerList](../../../../src/views/system/TriggerList.vue) | 查看调度触发器 | 筛选、ProTable | 1 | 保留精确清单；触发表达式提供可读摘要 |
| `/system/parameters` | [SystemParameterList](../../../../src/views/system/SystemParameterList.vue) | 系统参数配置 | 键值ProTable、编辑弹层 | 1 | 保留检索；可按作用域分组，不强改卡片 |
| `/system/maintenance` | [MaintenanceSettings](../../../../src/views/system/MaintenanceSettings.vue) | 维护模式与通知 | 分组表单、版本信息 | 0 | 保留表单；开始/预计恢复时间可增加摘要 |
| `/system/tags` | [TagManagement](../../../../src/views/system/TagManagement.vue) | 标签关联与检索 | 资源标签/搜索页签与子表 | 0 | 保留关联和筛选；避免纯色标签无文字 |
| `/system/event-catalog` | [EventCatalog](../../../../src/views/observability/EventCatalog.vue) | 事件类型与Topic目录 | 目录页签、ProTable、详情抽屉 | 2 | 保留；技术目录适合检索与比对 |
| `/config/management` | [ConfigManagement](../../../../src/views/system/ConfigManagement.vue) | 变更/Secret/同步管理 | 权限化页签、日志表、同步操作表单 | 0 | 保留职责分区；同步预览/差异/结果分步骤（U09） |
| `/ops/diagnostic` | [OpsDiagnostic](../../../../src/views/ops/OpsDiagnostic.vue) | 健康诊断与取证导出 | 按域状态块、导出表单和状态 | 0 | 保留；先呈现异常再展开原始诊断 |
| `/ops/shard-catalog` | [ShardCatalogList](../../../../src/views/ops/ShardCatalogList.vue) | 分片资源配置 | ProTable、编辑表单 | 1 | 保留管理清单 |
| `/ops/tenant-placements` | [TenantPlacementList](../../../../src/views/ops/TenantPlacementList.vue) | 租户分片放置 | ProTable、迁移配置表单 | 1 | 保留；迁移前后目标可做对比摘要 |
| `/ops/batch-day-replay` | [BatchDayReplay](../../../../src/views/ops/BatchDayReplay.vue) | 重放预览、审批与执行 | 范围/单日表单、多层会话/条目/版本表 | 5 | 按预览→审批→执行→结果分步骤和主从联动（U07） |
| `/system/notifications` | [NotificationManagement](../../../../src/views/system/NotificationManagement.vue) | 通知规则与投递治理 | 渠道/规则/Webhook/日志等五页签子表 | 0 | 配置表保留；投递链与失败处置集中，注意与Outbox职责（U09） |
| `/observability/queries` | [ObservabilityQueryTabs](../../../../src/views/observability/ObservabilityQueryTabs.vue) | 死信/重试/日志/回执检索 | 查询页签与各子表 | 0 | 保留多维检索；Trace贯通跨域关系（U02） |
| `/self-service` | [SelfServicePanel](../../../../src/views/system/SelfServicePanel.vue) | 租户自助申请与查询 | 服务卡片、内联配额、请求/查询抽屉 | 0 | 保留现有任务入口；不是表格堆叠主页 |
| `/m/ops/summary` | [MOpsSummary](../../../../src/views-mobile/MOpsSummary.vue) | 移动值班总览 | 指标网格、快捷入口 | 0 | 保留；每日计划总进度与桌面口径对齐待补（U11） |
| `/m/approvals` | [MApprovals](../../../../src/views-mobile/MApprovals.vue) | 移动审批 | 搜索、审批卡片、详情 | 0 | 保留卡片；关注目标/原因/风险可读性 |
| `/m/alerts` | [MAlerts](../../../../src/views-mobile/MAlerts.vue) | 移动告警处置 | 搜索、状态筛选、告警卡片 | 0 | 保留卡片；主动作和严重度明确 |
| `/m/jobs` | [MJobInstances](../../../../src/views-mobile/MJobInstances.vue) | 移动运行查找 | 搜索、状态筛选、运行卡片 | 0 | 保留；当前阶段摘要可与桌面共享事实 |
| `/m/jobs/:id` | [MJobInstanceDetail](../../../../src/views-mobile/MJobInstanceDetail.vue) | 移动作业详情 | 描述卡、步骤/分区/心跳进度 | 0 | 保留卡片；执行图/分母与桌面一致性待实查（U11） |
| `/m/workflow/:id` | [MWorkflowViewer](../../../../src/views-mobile/MWorkflowViewer.vue) | 移动流程查看 | 概要卡、图例、DAG、节点信息 | 0 | 已有DAG；冻结执行快照和推送刷新与桌面对齐待核（U11） |
| `/m/catchup` | [MCatchUp](../../../../src/views-mobile/components/MCatchUpPanel.vue) | 移动补跑审批 | 列表卡片、处理动作 | 0 | 保留；原因与影响范围优先 |
| `/m/files` | [MFileList](../../../../src/views-mobile/MFileList.vue) | 移动文件查找 | 文件卡片、下拉刷新 | 0 | 保留；文件状态到运行的上下文跳转 |
| `/m/workers` | [MWorkers](../../../../src/views-mobile/MWorkers.vue) | 移动节点查看 | 搜索、Worker卡片 | 0 | 保留；不移植桌面宽表 |
| `/m/outbox` | [MOutbox](../../../../src/views-mobile/MOutbox.vue) | 移动投递查看 | 投递卡片、下拉刷新 | 0 | 保留；失败原因与处理入口清晰 |
| `/m/logs` | [MExecutionLog](../../../../src/views-mobile/MExecutionLog.vue) | 移动执行日志 | 日志条目、筛选/刷新 | 0 | 保留日志形式，长文本需可展开 |
| `/m/desktop-only` | [MDesktopOnly](../../../../src/views-mobile/MDesktopOnly.vue) | 引导到桌面功能 | 说明与桌面入口 | 0 | 保留；不伪装成已具移动编辑能力 |
| `/maintenance` | [MaintenancePage](../../../../src/views/MaintenancePage.vue) | 维护状态告知 | 维护说明与重试 | 0 | 保留；等待状态不显示虚假完成度 |
| `/docs-unavailable` | [DocsUnavailable](../../../../src/views/DocsUnavailable.vue) | 文档不可用告知 | 错误说明与返回 | 0 | 保留错误态 |
| `/setup/initial-tenant` | [InitialTenantSetup](../../../../src/views/setup/InitialTenantSetup.vue) | 初始化租户与账户 | 分组表单 | 0 | 保留；真实提交未在本轮执行 |
| `/:pathMatch(.*)*` | [NotFound](../../../../src/views/NotFound.vue) | 未知地址恢复 | 错误页与返回 | 0 | 保留 |

# WDI 前后端能力承接核查 — 2026-10-25

## 目标、基线与方法

核查后端改造后，前端是否缺页面、操作、展示或所需 API。仅审查和记录，不实施应用功能，不执行真实后端业务写入、部署、提交或推送。

- 两仓均为 `fix/wdi-current`：前端 HEAD `662d254e2f8b97f93021de548815470d2291c997`，后端 HEAD `f3d5e400d3b5bd737124b57cf0a38e685432aab2`，读取当前未提交工作区；开始时完整 porcelain 记录分别为 617、1808 项。工作区记录数不表示本轮变更范围。
- 核查期间存在其他工作并行修改测试夹具、测试数据与部分后端资料/查询类，本轮全部保留。收尾对本报告链接的 46 处生产源码/Mapper 证据及 OpenAPI、前端生成类型做哈希核对，均与本轮起始内容一致；不把并行测试或历史验收记成本轮通过。
- 全量建立 **419 个 Console operation / 372 个 path** 目录，并与生产前端路径引用作静态匹配；包含 TypeScript/Vue 中的直接路径、常量前缀和动态模板候选，排除生成类型和测试。
- 静态匹配不能推断按钮存在、角色正确、请求语义或真实落库。按候选进一步检查 Controller/DTO/权限、Orchestrator 实现、API 封装、路由/导航与页面动作，形成下列 **13 项具体问题/条件增强**。并非对所有页面每个字段、全部 API 和业务链逐一运行验收。
- [419 项端点裁定](frontend-backend-endpoint-coverage-2026-10-25.csv)保留路径候选与人工归类。没有直接路径命中不等于缺功能；兼容、弃用、探针、测试管理、审批替代入口和 SDK 目录分别标注。

## 实施阶段追加

以下问题表记录初始审查事实。用户随后授权全部实施，并增加运行依赖图、Job/WF进度和租户今日统计；当前实现和正式验收状态以 [17项实施矩阵](../engineering/backend-capability-alignment-plan-2026-10-25.md) 为准。2026-10-26重新与WDI实际OpenAPI逐项作双向差集，CSV为431个operation／383个path，无缺失、额外或重复端点；最初419项和中途430项仅为各批时点快照。CSV原审查列保留历史判断，新增“当前契约用途／当前证据边界／当前证据入口”三列说明目前实现及局部验收，不能把初始待验文字当作当前未实现，也不能把静态引用当作端到端通过。

## 初始核查结论（历史快照）

本节保留初始核查及中间实施当时的结论；B01和各G/P项当前已完成限定范围的本地真实验收，以前述17项主矩阵的当前收口状态为准。

初始审查确认有前端承接缺口，主要可补在现有页面；其中 B01 是当时唯一明确缺少的后端 Console 查询。本轮已新增 B01 安全分页查询并接入“调度快照”页签；真实 Mapper 查询与持久化回读仍未验收。

本轮发现：4 项优先的已有 API 未接功能（G01–G04），1 项现有页面权限承接问题（G05），7 项部分承接或按产品使用范围决定的增强（G06–G12），1 类覆盖两个持久等待来源的后端查询与前端展示缺口（B01）。P2 候选不代表每项都必须新增菜单，也不因 API 存在自动要求实现所有扩展。

## 当前问题与最小承接位置

| ID | 优先级 | 分类 | 能力 | 现状 | 责任 |
|---|---|---|---|---|---|
| G01 | P1 | 前端功能缺口 | 批次日治理与补齐控制 | API 已有4项 | 前端 |
| G02 | P1 | 前端功能缺口 | 跨日历与作业依赖等待 | 查询与跨日历人工动作 API 已有3项 | 前端 |
| G03 | P1 | 前端功能缺口 | 运行实例暂停与恢复 | Job/Workflow 各 pause/resume，共4项 API 已有 | 前端 |
| G04 | P1 | 前端功能缺口 | Atomic executor 实际门控状态 | atomic-runtime-status API 已有 | 前端 |
| G05 | P1 | 前端权限承接缺口 | 现有页面敏感操作权限未对齐 | 配置同步与 Workflow 运行管控均有 ADMIN_ONLY API，非缺 API | 前端 |
| G06 | P2 | 前端部分承接 | 结果版本治理 | list/effective/detail/promote/reject API 已有；前端只接 list 用于 replay 选择 | 前端 |
| G07 | P2 | 条件性前端扩展 | Atomic 已保存配置复用 | atomic-task-configs GET/POST 已有 | 前端；产品确认是否开放 |
| G08 | P2 | 条件性前端扩展 | OIDC 身份绑定管理 | identities 查询/绑定/解绑3项 API 已有；OIDC 登录按钮已有 | 前端；身份管理员确认使用范围 |
| G09 | P2 | 条件性前端扩展 | 取证包导出与下载 | forensic export/download 两项 API 已有 | 前端；运维确认使用范围 |
| G10 | P2 | 前端诊断增强 | Worker 已认领任务与终态子任务健康 | claimed-tasks、cluster-diagnostic/terminal-children API 已有 | 前端 |
| G11 | P2 | 前端交互增强 | Workflow 历史版本选择 | versions 列表和单版本快照 API 均已有 | 前端 |
| G12 | P2 | 前后端契约与前端入口补齐 | 人工文件入站并绑定文件组 Workflow | presign-upload/content/confirm-arrival 已有；本轮新增租户启用上传目标查询和可选绑定请求体 | 前后端 |
| B01 | P1 | 后端 Console API 缺口＋前端展示缺口 | readiness / 容量准入持久等待的查询 | 初始419项契约未提供；2026-10-26新增安全分页API并接入现有等待面板，真实回读待验 | 后端与前端 |

### G01 批次日治理与补齐控制

在 BatchDayList/Window 增加历史缺口清单、catch-up 预览/暂停恢复及 FREEZE/RELEASE/SKIP/REOPEN/CLOSE/SETTLE_EMPTY 的合法动作；保留现有定时 occurrence 补登，二者不是同一功能。

- 后端证据：[源码](../../../file-batch-system/batch-console-api/src/main/java/io/github/pinpols/batch/console/domain/job/web/ConsoleBatchDayController.java)。
- 前端证据：[batchDays.ts](../../src/api/batchDays.ts)、[BatchDayWindow.vue](../../src/views/scheduler/BatchDayWindow.vue)。
- 实施/验收条件：限定租户/日历/日期；管理员动作、原因、幂等键及冲突反馈；重新查询持久状态，不能只显示 toast。

### G02 跨日历与作业依赖等待

在调度或运行监控增加等待列表/抽屉，展示依赖快照、等待原因、最近检查和超时；管理员 RELEASE/SKIP 使用已有审计入口。作业依赖当前只有查询，不能自行增加强制放行按钮。

- 后端证据：[源码](../../../file-batch-system/batch-console-api/src/main/java/io/github/pinpols/batch/console/domain/job/web/ConsoleCalendarDependencyWaitController.java)。
- 前端证据：[scheduler.ts](../../src/api/scheduler.ts)、[SchedulerSnapshot.vue](../../src/views/scheduler/SchedulerSnapshot.vue)。
- 实施/验收条件：WAITING/释放/跳过状态按服务端刷新，保留 reason；读权限与 ADMIN 写权限分开，切租户不能串数据。

### G03 运行实例暂停与恢复

在 JobInstanceDetail、WorkflowRunDetail 及适用列表增加 RUNNING→PAUSED / PAUSED→RUNNING 操作。现有 Workflow 定义 schedule pause 仅停止定时 fire，不能代替暂停已启动的运行。

- 后端证据：[源码](../../../file-batch-system/batch-console-api/src/main/java/io/github/pinpols/batch/console/domain/workflow/web/ConsoleWorkflowRunController.java)。
- 前端证据：[workflowRuns.ts](../../src/api/workflowRuns.ts)、[WorkflowRunDetail.vue](../../src/views/monitor/WorkflowRunDetail.vue)。
- 实施/验收条件：仅 ADMIN；按真实状态显示动作并重查；说明暂停不杀在途任务，已成功任务不重跑；冲突和恢复后的推进需真实验收。

### G04 Atomic executor 实际门控状态

在 AtomicTaskTypeCenter 或运维诊断补只读运行时面板。当前页面读取静态 task schema，不能用静态默认值判断实际 executor 开关、白名单和执行环境。

- 后端证据：[源码](../../../file-batch-system/batch-console-api/src/main/java/io/github/pinpols/batch/console/domain/ops/web/ConsoleAtomicRuntimeStatusController.java)。
- 前端证据：[customTaskTypes.ts](../../src/api/customTaskTypes.ts)、[AtomicTaskTypeCenter.vue](../../src/views/system/AtomicTaskTypeCenter.vue)。
- 实施/验收条件：available=false 或反向通道未配置显示不可用原因，不伪造全绿；只读展示脱敏后的实际门控，不增加开关写操作。

### G05 现有页面敏感操作权限未对齐

ConfigManagement 对多个角色开放入口，ConfigSyncTab 未读取权限并仍提供导出/预览/导入。需在 tab 与按钮/处理函数按后端 ADMIN 口径约束，保留其他配置查询的独立权限。后端授权仍裁决。

同类现状还出现在 WorkflowRunDetail：取消按钮仅判断 `run` 存在，跳过只按节点状态判断，处理函数没有角色前置检查；后端 WorkflowRunController 全类 ADMIN_ONLY。应同时对齐敏感操作的前端权限/状态，并保留只读运行详情。证据：[运行详情](../../src/views/monitor/WorkflowRunDetail.vue)、[运行管控权限](../../../file-batch-system/batch-console-api/src/main/java/io/github/pinpols/batch/console/domain/workflow/web/ConsoleWorkflowRunController.java)。

- 后端证据：[源码](../../../file-batch-system/batch-console-api/src/main/java/io/github/pinpols/batch/console/web/ConsoleConfigSyncController.java)。
- 前端证据：[ConfigManagement.vue](../../src/views/system/ConfigManagement.vue)、[ConfigSyncTab.vue](../../src/views/system/components/ConfigSyncTab.vue)。
- 实施/验收条件：四角色核对导航、直接路由和按钮；非 ADMIN 不应误显同步及运行取消/终止/跳过等 ADMIN 操作。后端仍会拒绝，本轮没有证明可越权写入。

### G06 结果版本治理

在现有重放或血缘页面增加结果版本详情与可选治理抽屉；不必为每个端点新建菜单。当前能选择重放版本，不等于能查看有效版本明细或提升/拒绝候选。

- 后端证据：[源码](../../../file-batch-system/batch-console-api/src/main/java/io/github/pinpols/batch/console/domain/job/web/ConsoleResultVersionController.java)。
- 前端证据：[batchDayReplay.ts](../../src/api/batchDayReplay.ts)、[useBatchDayReplay.ts](../../src/views/ops/composables/useBatchDayReplay.ts)。
- 实施/验收条件：权限、幂等和 PENDING 等合法状态；写后确认 EFFECTIVE 唯一及审计；payload 脱敏。是否开放人工 promote/reject 按产品操作范围确定。

### G07 Atomic 已保存配置复用

Atomic 节点配置中心现已接入已有配置查询/创建，可按当前租户和执行器类型复用参数预设；仅 ADMIN/TENANT_ADMIN 可访问持久配置，敏感字段在前端预检且由后端再次拒绝。不向四类 Workflow 节点库添加新节点。当前接口只有 list/create，因此不宣称编辑或删除。

2026-10-26 增量：补查发现列表/映射字段被表单作为字符串提交，服务端原先只查字段名与必填，可能保存类型错误的参数。现保存前将合法 JSON 文本解析为列表/对象，错误格式与 Shell 内联凭据在页面提示；服务端按 schema 校验类型并在写库前拒绝。原批次后端配置服务及 schema 测试 24 项、前端纯逻辑测试 4 项通过；随后补齐 Shell `args` 字符串元素约束，Console 配置服务 14 项、Worker Shell 执行器 24 项及前端纯逻辑测试 5 项通过；新增行为未重跑真实认证浏览器和数据库回读，既有真实联调报告只代表当时的 SQL 配置场景。

- 后端证据：[源码](../../../file-batch-system/batch-console-api/src/main/java/io/github/pinpols/batch/console/domain/ops/web/ConsoleAtomicTaskConfigController.java)。
- 前端证据：[AtomicTaskTypeCenter.vue](../../src/views/system/AtomicTaskTypeCenter.vue)、[JobDefinitionList.vue](../../src/views/job/JobDefinitionList.vue)。
- 实施/验收条件：真实 Console 持久化读回、租户/执行器隔离、角色浏览器与重复名称冲突仍待联验；只将 schema 允许参数保存，拒绝凭据明文。后端只有 list/create，不能宣称已有完整编辑/删除 CRUD。

### G08 OIDC 身份绑定管理

启用企业登录时，在账户管理提供 ADMIN 维护身份绑定的抽屉。当前只接 provider 与登录重定向，不能据此称 OIDC 整体未实现。

- 后端证据：[源码](../../../file-batch-system/batch-console-api/src/main/java/io/github/pinpols/batch/console/domain/rbac/web/ConsoleOidcController.java)。
- 前端证据：[oidc.ts](../../src/api/oidc.ts)、[Login.vue](../../src/views/login/Login.vue)。
- 实施/验收条件：只允许 ADMIN；明确 tenant、issuer/subject 与本地账户；绑定/解绑审计、冲突与失败处理，不能通过前端授权外部用户。

### G09 取证包导出与下载

需要控制台取证时，在诊断页补受控日期/Job 范围导出和下载。后端目前同步小范围 v0.1，不把它设计成无限范围异步导出中心。

- 后端证据：[源码](../../../file-batch-system/batch-console-api/src/main/java/io/github/pinpols/batch/console/domain/ops/web/ConsoleForensicController.java)。
- 前端证据：[clusterDiagnostic.ts](../../src/api/clusterDiagnostic.ts)、[OpsDiagnostic.vue](../../src/views/ops/OpsDiagnostic.vue)。
- 实施/验收条件：ADMIN、显式敏感导出范围与审计；下载真实 ZIP 并核对版本/范围；大范围异步和长期保留不是当前已提供能力。

### G10 Worker 已认领任务与终态子任务健康

在 Worker 详情/运维诊断补对应明细。现有 Worker 状态、一致性与 Outbox 卡片不直接展示这两项；不是要重做全部诊断页。

- 后端证据：[源码](../../../file-batch-system/batch-console-api/src/main/java/io/github/pinpols/batch/console/domain/ops/web/ConsoleClusterDiagnosticController.java)。
- 前端证据：[clusterDiagnostic.ts](../../src/api/clusterDiagnostic.ts)、[WorkerManagement.vue](../../src/views/worker/WorkerManagement.vue)。
- 实施/验收条件：读权限、时间窗口、租户与 Task/Instance 深链准确；终态父记录不能掩盖未收敛的活动子任务。

### G11 Workflow 历史版本选择

当前差异页能读取真实两版本，但列表动作只默认比较 version-1 与 version，没有调用 versions 清单供选择任意已保存版本。按需要补选择器，不应声称后端缺版本 API。

- 后端证据：[源码](../../../file-batch-system/batch-console-api/src/main/java/io/github/pinpols/batch/console/domain/workflow/web/ConsoleWorkflowDefinitionController.java)。
- 前端证据：[workflowDesigner.ts](../../src/api/workflowDesigner.ts)、[WorkflowDefinitionList.vue](../../src/views/workflow/WorkflowDefinitionList.vue)。
- 实施/验收条件：仅列实际存在版本；可选择历史两版并核对图和参数，不把缺快照当空图；清理过期源码注释。

### G12 人工文件入站上传

FileList 已在现有上传抽屉承接普通上传和文件组 Workflow 上传。绑定上传先读取租户唯一启用目标和 IMPORT 模板，提交业务日、必需文件集合及模板；后端将其写入托管文件元数据和 `file_record.biz_date`，只有对象内容上传并确认到达后，到达组扫描才会把完整文件束交给 `BundleArrivalLauncher`。普通上传仍按原参数兼容。外部 NAS/SFTP/HTTP 自动入站不属于该缺口。

- 后端证据：[Console API](../../../file-batch-system/batch-console-api/src/main/java/io/github/pinpols/batch/console/domain/file/web/ConsoleFileController.java)、[文件组绑定校验](../../../file-batch-system/batch-orchestrator/src/main/java/io/github/pinpols/batch/orchestrator/application/service/batchday/FileGroupExpectationService.java)。
- 前端证据：[file.ts](../../src/api/file.ts)、[FileList.vue](../../src/views/file-center/FileList.vue)。
- 当前验证：前端 API 定向 5 项、typecheck、i18n 与 OpenAPI 类型漂移检查通过；后端编译通过，Orchestrator 上传/目标单测 43 项和 Console 文件服务/控制器单测 10 项通过。原始普通上传真实 E2E 仍有效；新补的跨 30 秒扫描占位保护及文件组 Workflow 真实触发 E2E 尚未运行，不能据此关闭 G12。验收须独立读回对象字节、到达审计和 Workflow 终态，并证明确认前运行数为0。

### B01 readiness / 容量准入持久等待的查询

后端补受租户/角色保护的只读分页查询与详情，可统一 waitType，也可分别暴露。前端在同一等待监控中展示。现有 job-dependency-waits、asset readiness 和 trigger-status 不等同于这两类持久等待记录。

- 后端证据：[源码](../../../file-batch-system/batch-orchestrator/src/main/java/io/github/pinpols/batch/orchestrator/application/readiness/ReadinessWaitService.java)。
- 前端证据：[workflow.ts](../../src/api/workflow.ts)、[WorkflowRunList.vue](../../src/views/monitor/WorkflowRunList.vue)。
- 实施/验收条件：展示来源允许的状态、依赖/原因、deadline、attemptCount、nextAttemptAt、lastErrorCode、requestId/traceId 与最终运行关联；字段按等待源可空，不编造。禁止返回 sealedSnapshotPayload、密文原载荷或内部 Secret；本项不要求新增强制放行写 API。

## B01 的接口范围应先明确

`ReadinessWaitController` 只有内部 handover/close 写入口；`ReadinessWaitEntity` 已有依赖、原 fire、deadline、状态及错误。`WorkflowLaunchWaitService` 与 Mapper 持久化容量准入等待、attempt_count 和 next_attempt_at；原请求能保持 PROCESSING，但尚未形成 Workflow Run 时不会出现在运行列表中。

相关证据：[readiness 内部控制器](../../../file-batch-system/batch-orchestrator/src/main/java/io/github/pinpols/batch/orchestrator/controller/ReadinessWaitController.java)、[等待模型](../../../file-batch-system/batch-orchestrator/src/main/java/io/github/pinpols/batch/orchestrator/domain/entity/ReadinessWaitEntity.java)、[容量等待服务](../../../file-batch-system/batch-orchestrator/src/main/java/io/github/pinpols/batch/orchestrator/application/service/workflow/WorkflowLaunchWaitService.java)、[容量等待 Mapper](../../../file-batch-system/batch-orchestrator/src/main/resources/mapper/WorkflowLaunchWaitMapper.xml)、[触发回执 DTO](../../../file-batch-system/batch-console-api/src/main/java/io/github/pinpols/batch/console/domain/workflow/application/contract/response/WorkflowTriggerStatusResponse.java)。

新增建议是只读运维契约：按 tenant、Workflow/Job、业务日、waitType/status 限定并分页，区分 readiness、作业依赖、跨日历依赖与容量准入。现有 job-dependency-waits 只能代表自身等待源，SchedulerSnapshot 的队列负载也不能代替原请求的持久等待明细。前端不调用内部 X-Internal-Secret 端点，不展示冻结原始载荷，也不因缺明细增加“重新发起”来恢复未知结果。

## 已有承接，不应重新判成待开发

以下有当前源码链路，仍须分别保留实际环境验收边界：

| 能力 | 前端承接证据 | 本轮结论边界 |
|---|---|---|
| Job 与系统 Pipeline 阶段、四类节点设计器 | `JobDefinitionList.vue`、`SystemPipelineStages.vue`、`workflowDesigner.ts` | 独立租户 Pipeline 编辑已退役，不应恢复旧菜单。 |
| Workflow 调度、手工/多选发起与原请求只读核对 | `workflow.ts`、`useWorkflowBulkTrigger.ts`、`WorkflowDefinitionList.vue` | 已有承接；未将 schedule pause 等同运行 pause。 |
| Workflow/Job 运行详情、节点关联与整图/失败节点恢复 | `WorkflowRunDetail.vue`、`JobInstanceDetail.vue`、`workflowRuns.ts` | 不是运行详情整页缺失；G03 补具体动作。 |
| 日期范围重放、session、逐项结果与版本选择 | `batchDayReplay.ts`、`useBatchDayReplay.ts` | 动态 query suffix 未直匹配的 entries 不能当 API 缺失。 |
| 配置包场景模板、预览/行修订/Apply、配置同步结果核对 | `tenantPackageExcel.ts`、`ConfigSyncLogsTab.vue` | 已有承接；G05 是权限交互，不能据此称同步业务完全未实现。 |
| 终态通知冷热历史和人工核对后重投 | `terminalNotifications.ts`、`NotificationTerminalDeliveriesTab.vue` | 已有承接，真实外部投递与 exactly-once 不由 UI 存在证明。 |
| 资产 readiness、血缘和 freshness policy | `lineage.ts`、`LineageEvidence.vue`、`AssetFreshnessPolicies.vue` | 资产结果裁定不同于 B01 的持久等待可视化。 |
| 单/批账号开户与原 requestId 操作恢复 | `userAccounts.ts`、`UserBatchProvisioningDialog.vue` | by-id API 未直接调用不能算整页缺失。 |
| OIDC 登录入口 | `oidc.ts`、`Login.vue` | 登录已有；G08 仅管理员绑定维护未接。 |
| Worker 生命周期、指纹和任务心跳/checkpoint | `WorkerManagement.vue`、`WorkerFingerprintBoard.vue`、`JobInstanceDetail.vue` | 不等于所有 Worker 诊断明细都已接。 |
| 资源队列、配额、调度快照与容量视图 | `QueueConfig.vue`、`QuotaPanel.vue`、`SchedulerSnapshot.vue` | 后端准入算法修复无需每次新增页面；等待明细另按 B01。 |
| AI、常规告警/日志、文件渠道模板与现有文件处理 | 当前对应 API 与导航/页面 | 仅核对存在与调用，未对所有字段和旅程作本轮验收。 |

## 推荐顺序与关闭条件

1. 前端先补 G01/G02/G03，并修 G05。优先在既有调度、运行和配置页面添加操作/抽屉，按后端权限与状态机控制，而不是新增一组平行菜单。
2. B01 已按最小安全读 DTO/OpenAPI 补齐，并在调度快照页提供只读等待监控；待真实数据库、服务间调用和租户角色验收。没有实际等待明细前不能用总计数推断单请求状态。
3. G06–G12 按结果治理、企业登录、人工上传及运维使用范围排序；API 已有部分先复用，只有新增的编辑/删除/异步等目标确有需求时再设计 API。
4. 关闭分别证明：前端权限/租户/未知结果状态正确 → 请求命中真实 API → 服务端执行目标正确 → 持久化/审计/恢复结果可读。静态类型、HTTP200 与成功提示不能替代业务闭环。

## 本轮验证

- 初始核查：后端 `python3 scripts/ci/check-console-openapi-paths.py`，Controller 与 OpenAPI 一致，419 routes。
- PASS：前端 `npm run gen:api:check`，读取同级 WDI OpenAPI，生成类型同步；未重新生成或修改生成文件。
- 初始静态核查：419 项目录与路径候选；13 项具体问题/条件增强的源链交叉。2026-10-26复核：OpenAPI路由检查通过，430 routes；新增B01真实数据库执行未验。
- PASS：前端 `npm run check:docs`，73 篇当前文档链接/路径检查；本轮文档差异格式核对通过。
- 未执行：应用单测、真实浏览器、全量 API 请求、业务写入、等待/故障注入、部署或后端验收。路线和字段建议是待实施，不是已交付功能。

初始审查轮仅新增审查记录/端点裁定。2026-10-26实施轮修改了前后端应用代码，相关静态与定向证据和未验边界见实施矩阵及日期化执行记录。历史治理审查和以前的通过记录不作为本轮功能已闭环的证据。

## 2026-10-26 实施增量

- G04 Atomic 运行态面板现已通过真实本地联调：Worker Actuator 与 Console 反向查询的四类执行器状态逐字段一致；真实认证角色结果为 ADMIN/TENANT_ADMIN 200、AUDITOR/TENANT_USER 403；脱敏输出不含密码、密钥、令牌或 JDBC 地址，临时数据清理为零。另验证禁用反查时的安全降级提示。该结果关闭 G04 本地真实联调，不代表生产发布验收，细节与证据见[实施矩阵](../engineering/backend-capability-alignment-plan-2026-10-25.md)和[作业进度报告](../reports/2026-10-25-job-execution-progress.md)。
- 进度图表承接位置确认：租户业务日五层统计放现有运维总览，Job 阶段/分区/任务进度放作业详情，Workflow 冻结依赖图和节点状态放运行详情/DAG 页；使用全快照推送更新，保持总览指标与单次执行上下文分层。
- 2026-10-26真实控制DAG验收观察到Workflow暂停/恢复全快照、冻结图在定义编辑后保持不变、WAIT=SKIPPED及END=NOT_EXECUTED；租户日统计仅核对手工业务日的Workflow行，不代表Quartz或当前日期覆盖，详见实施计划与作业进度报告。
- 2026-10-26结果版本治理真实验收通过：Console版本响应不含`payloadJson`/`payloadRef`；真实浏览器验证提升/归档、唯一EFFECTIVE、四角色与跨租户边界，数据库读回三条成功操作审计且精确清理为零。G06状态更新见[实施计划](../engineering/backend-capability-alignment-plan-2026-10-25.md)和[验收报告](../reports/2026-10-26-result-version-governance.md)。

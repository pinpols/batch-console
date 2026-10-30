# WDI 作业阶段与依赖上下文进度实施快照

本批继续17项能力对齐中的G03/P00/P01/P02。两仓仍为`fix/wdi-current`，前端HEAD `662d254`，后端HEAD `f3d5e400d`，工作内容包含既有未提交修改；没有提交、推送或PR。本报告只关闭文中明确的本地真实子链路，不关闭17项整体矩阵或发布验收；当前状态见[实施矩阵](../engineering/backend-capability-alignment-plan-2026-10-25.md)。

## 实际实现

- 新增Job进度GET与完整SSE快照接口，订阅入口先授权，后台采样设置事务RLS租户，冻结关联与运行计数在同一只读一致性事务读取。DTO只暴露状态/标识/计数，不返回业务输入、参数或结果载荷。
- 平台阶段采用Pipeline运行标识与语义版本；尚无Pipeline时采用所属Workflow执行快照中冻结的`jobDefinitions`标识。当前作业定义不作为历史图事实源。未知版本或观察到未知阶段时保留实际记录、明确图无法核实。
- 分区分母为本次Job预期分区；技术任务分母仅为已创建任务。成功与收口分别显示，零/未知或矛盾分母不计算百分比。重试阶段按stage_code/run_seq/id选最新，无执行记录在活跃Job为PENDING、终态为NOT_EXECUTED，不补造成功。
- 作业详情展示阶段顺序图、任务/分区状态、当前阶段、处理行数、重试序号、原因码及Pipeline深链；嵌入所属Workflow冻结DAG。六阶段首次自动适配全图，保留缩放。详情按钮与状态接收推送，旧详情HTTP响应不回退状态，租户/实例切换清理旧流与旧响应。
- 数据库V124唯一索引保证同一Job至多一个Pipeline，因此未将最初怀疑的“多个Pipeline串位”当作已证实缺陷，也未变更关联或唯一性约束。

## 验证与边界

后端5项服务单测与3项真实Testcontainers PostgreSQL映射测试通过，覆盖租户隔离、最新阶段重试、未知版本/未知阶段、终态缺记录，以及尚无Pipeline时读取冻结版本。前端流/聚合/生命周期共27项定向通过；类型、i18n、ESLint、fixture事实源、生成类型漂移及构建已验证。浏览器夹具验证六阶段、分区50%/任务67%独立分母、父Workflow两节点、暂停推送后恢复按钮及Pipeline深链。早期夹具因缺正式响应message字段与管理员租户列表两次失败，均未计为产品通过；修正后重新执行。

浏览器使用WDI固定构建preview与路由夹具。SSE有限响应关闭后会显示重连，截图中的重连与静态时间属于夹具，不是生产实时连接证据。既有真实Workflow控制流程联调见[运行进度联调](2026-10-25-runtime-progress-integration.md)，不能扩展成新Job/Worker接口已通过真实业务验收。

当前Job处理行数只来自持久化checkpoint；Orchestrator实时cache补充、现有文件Pipeline页面dirty+GET/轮询迁移、真实Worker启动/分区执行/失败恢复与Quartz每日计划联动仍待继续完成。进度页和接口编码完成不等于这些业务链关闭。

最终固定构建浏览器回归：Job进度与既有Workflow图共2项通过、0跳过、0重试；427条Console Controller/OpenAPI路径一致。布局人工检查：[作业阶段与分母](assets/job-progress-2026-10-25/job-progress.png)、[同页所属Workflow](assets/job-progress-2026-10-25/job-workflow-context.png)。两图均为路由夹具证据，不能作真实Worker截图。

后续进展见[Pipeline完整推送批次](2026-10-25-pipeline-progress-push.md)：已迁移旧Pipeline页面并补Job实时空值，终态缓存回归修复；本报告上文保留当批历史边界。实际Worker、失租源缓存隔离与Quartz仍未关闭。

## 2026-10-26 真实 Atomic Worker 联调

本轮最终使用 `fix/wdi-current` 的 WDI 前后端工作树和本地运行包，通过真实认证、独占租户与 Atomic Worker 执行 `SELECT pg_sleep(18), 1`。Chromium E2E 1/1 通过，0重试；真实执行在 PostgreSQL 中读到 Job 实例、分区、技术任务 RUNNING，随后均变为 SUCCESS，Workflow 的 START、Atomic Job 与 END 节点也全部终结。

运行中 Workflow 快照保留节点原始 `nodeStatus=READY`，并返回匹配的 `jobInstanceId` 与独立 `jobInstanceStatus=RUNNING`；前端 DAG 节点显示运行中，表格仍可看到 Workflow 自身状态。推送包含 workflow、job、daily 三类完整快照。作业详情与租户业务日统计各在4.5秒观察窗口内没有周期 GET；运维总览现有五层图表与分层计数显示触发请求、Workflow、Job实例及已创建任务。该夹具使用手工触发的业务日（2026-11-16），`scheduledDefinitions=0`；这证明真实执行进度和现有图表联动，不证明Quartz日计划。

后端本轮 `WorkflowExecutionGraphAssemblerTest` 与真实 PostgreSQL `WorkflowExecutionMapperIntegrationTest` 共9项通过；前端类型检查、OpenAPI生成漂移、4项DAG工具单测、i18n/生产构建、文档检查与fixture来源门禁通过。Playwright成功场景的全部清理计数为0（含Workflow/Job/Task/Worker/租户/临时账号）；首次错误断言场景也独立清理为0。第一次真实浏览器尝试是测试选择器对两条合法进度条使用唯一定位，已改为按计划分区与已创建任务的可访问名称分别断言。最终首页截图已关闭首次使用导览，无遮挡。

证据文件：[脱敏运行摘要](assets/worker-progress-2026-10-26/worker-progress-evidence.json)、[真实运行 DAG](assets/worker-progress-2026-10-26/workflow-dag-running.png)、[作业详情](assets/worker-progress-2026-10-26/job-progress-running.png)、[租户业务日统计图](assets/worker-progress-2026-10-26/tenant-daily-progress.png)。范围边界：Worker失败/恢复、文件Pipeline阶段以及真实Quartz计划仍未验收；本轮只关闭对应真实Atomic成功子链路，不关闭17项整体矩阵或发布验收。

## 2026-10-26 Job暂停/恢复真实验收

扩展并运行 `npm run test:e2e:worker-progress:real`，使用真实认证、WDI Console/Orchestrator、本地 PostgreSQL、独占临时租户与 Atomic Worker。未登录 `/auth/me` 为401；租户管理员请求 Job pause 被后端拒绝为403且实例仍为RUNNING。管理员在作业详情确认暂停与恢复，数据库回读为RUNNING→PAUSED→RUNNING，完整 SSE 观察到RUNNING→PAUSED→RUNNING→SUCCESS。暂停期间不强杀在途SQL任务；恢复后任务、分区、作业和Workflow均成功终结。

本场景1/1通过、0重试，Worker及业务数据、租户、临时账号和相关审计等精确清理计数全部为0。真实认证仅在本次本地验收窗口启用，之后恢复 `.env.local` 的默认旁路配置，匿名 `/api/console/auth/me` 回到200。脱敏机器结果和成功后的详情截图：[证据JSON](assets/job-pause-resume-2026-10-26/real-worker-evidence.json)、[作业详情截图](assets/job-pause-resume-2026-10-26/job-progress-resumed.png)。

另外修复运维总览日统计明细表在首屏宽度下被截断的问题：将完整状态表放入具名键盘可聚焦横向滚动区。动态行标签缺少数据时回退到中英文已有“未知”词条；`e2e/tenant-daily-progress.spec.ts` 在1440px与768px确认最后一列可滚动到达，并断言无`dailyProgress.undefined`翻译告警，1/1通过。该布局用路由夹具验证，不作后端数据真实性证据；截图见[桌面](assets/daily-progress-table-scroll-2026-10-26/desktop-fixture.png)、[窄屏](assets/daily-progress-table-scroll-2026-10-26/narrow-fixture.png)与[末列](assets/daily-progress-table-scroll-2026-10-26/last-columns-fixture.png)。

## 2026-10-26 Atomic 运行态真实验收

使用 WDI 本地真实 Atomic Worker、Console、PostgreSQL 与真实认证运行 `npm run test:e2e:atomic-runtime:real` 的 available/unavailable 两种模式，共2/2通过、0重试。实际 Worker `/actuator/atomicruntime` 返回 shell、SQL、HTTP、stored procedure 四类有效门控；Console 反向查询逐字段匹配。浏览器中运行态面板展示实际 Worker 身份和四类执行器，没有写开关。另临时禁用 Console 反查，确认降级原因可见且执行器明细表隐藏。最终 available 模式复跑包含`atomicRuntime.executors.undefined`告警断言并通过。

两个模式的权限回读均为 ADMIN/TENANT_ADMIN 200、AUDITOR/TENANT_USER 403；运行态摘要不含密码、密钥、令牌或 JDBC 地址；两次的定义、运行、租户、审计、临时账号等清理计数全部为0。之后 Console 恢复 `.env.local` 默认旁路，匿名 `/api/console/auth/me` 回到200。证据：[可用模式摘要](assets/atomic-runtime-2026-10-26/verified-available.json)、[降级模式摘要](assets/atomic-runtime-2026-10-26/verified-unavailable.json)、[可用清理结果](assets/atomic-runtime-2026-10-26/cleanup-available.json)、[降级清理结果](assets/atomic-runtime-2026-10-26/cleanup-unavailable.json)、[可用页面](assets/atomic-runtime-2026-10-26/runtime-available.png)和[降级页面](assets/atomic-runtime-2026-10-26/runtime-unavailable.png)。此结果关闭 G04 的本地真实联调，不等同生产发布验收。

## 2026-10-26 Workflow 控制 DAG 与业务日图表验收

使用 `npm run test:e2e:progress:real` 对真实认证、Console、PostgreSQL 和 Chromium 完成 1/1 场景，0 重试。ADMIN 通过真实 API 暂停并恢复 Workflow；TENANT_ADMIN 暂停返回 403，跨租户 Workflow 进度和租户日统计读取均返回 403。详情页收到 RUNNING→PAUSED→RUNNING→SUCCESS 全快照。START 为 SUCCESS，WAIT 以`SENSOR_TIMEOUT_SKIP_DOWNSTREAM`原因为 SKIPPED，END 为 NOT_EXECUTED；编辑当前定义后重载，运行详情仍展示本次运行冻结的原始节点名称和依赖边。

统计图表继续放在现有运维总览 OpsSummary，运行DAG继续放在 Workflow 运行详情页。真实浏览器通过详情页按钮发起暂停/恢复并确认，全量 SSE 更新运行图；业务日统计图表和五层明细表读取夹具手工业务日 2026-11-16，Workflow行观测值为1/1，在线4.5秒无周期GET。匿名认证在验收期间为401，完成后本地默认旁路已恢复并核对为200。该业务日不是当前日期，夹具不创建Job/Worker，不能证明Quartz计划或真实当日覆盖完整。

脱敏机器结果：[真实验收摘要](assets/workflow-control-dag-2026-10-26/real-evidence.json)；浏览器截图：[冻结运行 DAG](assets/workflow-control-dag-2026-10-26/workflow-progress.png)、[运维总览日统计](assets/workflow-control-dag-2026-10-26/daily-progress.png)。该场景只补充控制DAG、推送和租户统计展示证据，不关闭 17 项矩阵中其他未验收项，也不代表生产发布验收。

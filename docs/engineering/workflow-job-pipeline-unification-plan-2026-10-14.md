# 作业与工作流联动、系统 Pipeline 前端实施方案

> **2026-10-24 B182 当前**：批量承接本地真实JWT/CSRF浏览器/HTTP验收已完成。三项发起出现受理、未知和明确拒绝时逐项呈现；仅按原键重试明确失败项，响应丢失后刷新保留原身份，核对只发GET且原请求/根运行不增加。6项认证/CSRF/身份拒绝检查通过；前端3文件31/31、typecheck/i18n/局部ESLint通过。修复缺失调度列翻译及Element Plus空行探测警告，最终浏览器重开无错误/警告。本轮测试数据库夹具和浏览器认证文件已清理，目标发布/质量门禁仍独立，后端执行日志B182为证据入口。

> **2026-10-24 B179 历史实施记录**：Workflow定义列表支持多选最多50项、显式业务日及逐项结果，客户端最多并发4项调用原单项入口。目标、日期和每项原键在发送前冻结，并按标签页/租户保存，刷新后的在途项标UNKNOWN；仅重试明确拒绝项。只读trigger-status核对原请求，404不证明未执行；存在未知项时不能清除后换键重发。预检单独操作。29项API/模型/组件定向、后端24项及真实Mapper回滚夹具通过，类型/i18n/生成契约和局部ESLint通过；新版本JWT/CSRF浏览器/HTTP及统一运行包仍待验收，详见后端执行日志B179。

> **2026-10-24 B173**：独立预检仍以明确 Job 目标调用，L1 不查询同编码 Workflow、不校验 Job 残留日程字段；前端中英文说明与后端 `validationScope=JOB`、`workflowValidated=false` 对齐。后端 41 个定向用例与 5 个真实认证 HTTP 检查通过，运行表计数不变；前端生成契约、类型和 i18n 检查通过。用户已确认保留Workflow多选批量发起、预检分开；当前新增承接以B182为准，不能据预检修复宣称批量已验收。代码质量门禁与目标发布范围独立于 36 个本地业务场景完成数，详见后端 B173 记录。

> 2026-10-24 本地收尾：配置同步日志已提供管理员按持久目标收据核对原结果的操作，期间固定租户/日志身份并拦截迟到刷新；终态冷热历史、人工确认重投和原身份审计经真实 JWT/CSRF 浏览器通过。类型、构建、API 漂移和专属 fixture 事实来源检查已通过。与后端共用的 R01–R36 本地场景在 B171 收口，正式状态及目标环境例外以[后端唯一验收矩阵](../../../file-batch-system/docs/plans/workflow-daily-integration-acceptance-matrix-2026-10-14.md)为准，B172冻结联合SIM28/28、strict21/21已通过，WARN按整轮原始证据及本轮精确分类记录，正常运行态默认审计4/4；8后端服务和本地前端已恢复。用户已确认Workflow批量发起与独立预检，该新增承接的本地真实联调已在B182完成，目标环境例外保留，不把本地结果写作发布完成。

> 决策日期：2026-10-14。状态：ImplementationInProgress，前端联动与后端契约正在分批落地。2026-10-25 文档治理仅核对职责与静态入口；当前局部进展见顶部原批次证据，整体正式验收仍以后端整合矩阵为准。
> 前端调查基线：`934b91a8`。状态：ImplementationInProgress；Pipeline 编辑入口退役、Job/Workflow 双菜单联动、显式 Workflow 触发和运行详情已部分落地，真实浏览器端到端和恢复旅程仍待完成。后端主方案是[Workflow 统一运行与 Pipeline 按类型关联实施方案](../../../file-batch-system/docs/plans/workflow-unified-execution-and-system-pipeline-plan-2026-10-14.md)。
> 本文只规定前端交互和联动验收；调度、状态、迁移和数据归属以后端主方案为准。

> 2026-10-19 增量：配置同步日志的 `RUNNING` 仅表示最终结果尚未确认，不证明业务未写入，也不把暂存0计数当作零成功/零失败。前端保留计划总数并显示待确认提示；已完成日志仍展示实际统计。组件定向验证、当前真实类型检查及i18n检查通过，具体命令和后端真实PG故障注入证据见[整合验证矩阵](../../../file-batch-system/docs/plans/workflow-daily-integration-validation-2026-10-14.md#2026-10-19-config-sync审计提交与日志故障隔离)。本轮无OpenAPI字段或生成类型变化，未执行真实浏览器全旅程；不据此关闭整体UI验收。

> 2026-10-16 最新口径：用户已确认全新数据库部署、不兼容旧系统，历史段落中的旧运行/旧包转换不是当前完成条件。Workflow 全量保存必须提供最近读取的版本；节点跳过原因和 Trigger 动作类型以后端 OpenAPI 生成结果为准。实测旧 `typecheck` 命令未检查任何源码，本文此前仅据该命令给出的类型通过记录不能作为有效源码类型证据。入口现已修复，真实应用检查仍有失败，须修复后再完成构建、浏览器和联合验收；命令与失败清单统一见[后端整合验证矩阵](../../../file-batch-system/docs/plans/workflow-daily-integration-validation-2026-10-14.md)。

> Pipeline 边界：保留 Pipeline/Definition/Step/Instance/阶段运行模型及其历史查询能力。本方案只取消 Job 对租户级 Pipeline 定义的手工选择/绑定，Job 按自身类型解析系统内置 Pipeline；前端退出可编辑的 Pipeline 定义入口，不代表删除 Pipeline 模型或数据表。

> 2026-10-25 当前入口核对：`/jobs/pipelines` 已从路由表移除，不再提供兼容重定向；请从作业定义进入。当前节点类型仅有 `START`、`END`、`JOB`、`GATEWAY`，旧 `FILE_STEP` 组件已移除，未知节点由编解码器拒绝。下文 2026-10-14 的只读旧节点/转换和当时测试数保留为历史实施证据，不代表当前仍支持这些入口或本轮重新验收。

## 1. 两个定义菜单保留

“作业定义”和“工作流定义”分别保留在准备作业分组。作业页管理可复用执行单元；工作流页管理组合、触发与整体策略。可编辑的“流水线定义”入口退出，Pipeline 的固定阶段展示保留在作业详情和运行详情中。

| 入口 | 用户可维护的内容 | 联动 |
|---|---|---|
| 作业定义 `/jobs/definitions` | 类型、执行参数、模板/通道业务引用、分片与已有执行策略 | 打开默认单作业 Workflow、查看引用它的组合流程、加入工作流 |
| 工作流定义 `/workflow/definitions` | 单作业/组合流程分类、调度、业务依赖、整体策略 | 打开引用的 Job；新增执行节点时选择现有作业 |
| 设计器 `/workflow/designer` | Job 节点、条件、依赖和既有控制节点 | 选中 Job 展示类型、只读内置 Pipeline 与类型化参数覆盖 |
| 整体运行 `/monitor/workflow-runs` | Workflow 运行检索、状态、操作、关联恢复运行 | 展开 Job Instance → 分区/任务 → Pipeline 阶段、文件和日志 |
| Pipeline 观测 `/files/pipeline-obs` | 原有细粒度阶段/进度观测 | 返回关联 Job/Workflow；保留技术排障能力 |

上述路径沿用当前页面归属；新字段和操作在后端实现后同步生成类型。不能仅改菜单或显示文案就宣称运行模型已统一。

## 2. 作业定义页面

作业类型自动决定系统 Pipeline。四类文件 Pipeline 的阶段说明从后端只读元数据读取；ATOMIC/GENERAL 展示各自执行方式，不固定展示“5 类 Pipeline”。用户无需选择或新建 Pipeline 定义。

新建作业一次提交，由后端事务创建 Job 与受管单作业 Workflow。前端使用返回的真实关联，不发两次创建请求，也不按 jobCode 拼接/猜测 workflowCode。

详情新增关联区：

- 默认单作业 Workflow：名称、启用状态、调度摘要、最近运行和详情链接。
- 引用该作业的组合 Workflow：按后端分页查询，显示节点名称和关联链接。
- 运行此作业：调用默认单作业 Workflow 的统一触发入口，反馈 Workflow Run 和关联 Job 实例。

作业页若提供调度编辑快捷入口，应调用 Workflow API；两个页面显示相同字段来源。作业启停提示其对所有引用流程的影响；删除冲突展示真实引用，不在前端自行解除关系。

## 3. 工作流定义与设计器

工作流列表用“单作业/组合流程”类别筛选，单作业流程具有与组合流程相同的运行/调度入口。受管单作业图是 `START → Job → END`，Job 引用和边界受系统管理。升级为多任务通过创建组合流程完成，后端保留稳定的默认单作业关联。

整个图只有一组 START/END。边界不可删除、复制或修改类型；服务端校验是最终裁决。组合流程可以编辑业务边和条件，不由前端自动追加会改变业务路径的边。

执行节点统一选择 Job，属性面板展示：

1. Job 编码、名称和类型，并可打开作业详情。
2. 固定系统 Pipeline 阶段图，只读。
3. 后端 schema 声明的节点输入映射和业务参数覆盖；按租户/角色过滤引用并提供服务端错误反馈。

当前 JOB、TASK、FILE_STEP 的运行路径并不完全相同。旧图通过后端转换预览处理引用和参数，设计器不得将类型文本替换后直接保存；节点输出 DSL、边、条件、join 和执行策略须保留可复核差异。WAIT/GATEWAY 等独立控制能力按既有契约保留。

## 4. 整体运行和状态反馈

所有新顶层运行以 Workflow Run 为整体视图。单作业默认直接展开唯一 Job，用户能立即看见类型相关进度；多作业显示整图，点击节点查看 Job Instance、分区/任务和阶段。已启动的并行分支全部收尾后才显示整体结束。

状态、阶段计数与 START/END 时间只使用后端事实。条件跳过和失败传播跳过要展示不同原因；补偿成功不能由前端推断为整体成功。暂停、取消、终止和重跑显示请求反馈及实际状态，不提前假定操作完成。

局部重跑以新的恢复 Workflow Run 展示，并关联原运行及复用结果；原终态运行保持历史状态。历史独立 Job 不补造 Workflow：提供明确的历史来源视图与现有 Job 深链。

Job Instance 和 Pipeline 观测的现有深链、文件关联、日志、审计能力保留为明细/排障入口。旧 `/jobs/pipelines` 路由当前已移除，现从 `/jobs/definitions` 进入作业定义；不能把阶段观测页面一并移除。

## 5. 契约和配置包

后端先更新 `docs/api/console-api.openapi.yaml`，前端运行 `npm run gen:api`；禁止手改生成类型或从 UI 构造后端不存在的字段。

同步受影响的 `src/api/system.ts`、`src/api/workflow.ts`、Designer 编码选项、RBAC 路由、菜单权威映射和 SSE Query Key。租户切换继续使用既有 reload/query 机制；所有请求走统一 API 客户端。

新 Excel/JSON 包移除 Pipeline 定义/步骤配置，作业类型旁展示系统阶段说明。旧包显示服务端转换预览，明确有效参数的目标 Job、未映射字段、引用冲突、修订冲突和应用计数；不能静默忽略旧 Sheet。

作业快捷触发、组合流程运行、导入和节点关联均经过后端权限/租户/资源准入。中文/英文文案保持同义；桌面和移动页面复用同一运行与关联逻辑。

## 6. 分批交付与验收

本方案配套后端 WF-1 至 WF-5。先具备系统目录、Job 参数与 Workflow 关联契约，再切换页面和触发；最后退役 Job 手工选择/绑定租户 Pipeline 的编辑入口与写操作。Pipeline 模型、执行/历史数据和只读查询能力继续保留，不以删除 Pipeline CRUD/API 客户端或路由作为目标。每批交付说明实际后端基线和兼容范围，避免先隐藏菜单却仍要求用户创建 Pipeline 定义。

| 旅程 | 必须验证的结果 |
|---|---|
| 新建单作业 | 一次提交生成真实默认流程；重复请求不重复建；两个菜单互跳准确 |
| 类型切换 | 固定阶段来自后端；不出现可编辑阶段顺序或错误类型 Pipeline；参数校验随类型变化 |
| 新建组合流程 | 复用已有作业；参数覆盖有 schema；边界不可编辑；环/跨租户/缺 Job 拒绝 |
| 单作业触发 | 同一 Workflow 入口，显示整体状态并展开 Job 进度 |
| 串行/并行/条件/失败 | 不提前结束；失败与跳过原因准确；旧图转换有差异预览 |
| 编辑与恢复 | 运行中编辑不改变原快照；暂停恢复、取消确认和局部重跑关联真实 |
| 旧包/旧链接/历史 | 转换错误可修复；关联和历史可查；Pipeline 阶段观测保留 |
| 权限/租户 | 四角色、跨租户拒绝、影响提示、审计与租户切换无数据串用 |

按当前项目入口执行类型生成检查、适用 preflight、Vitest 和 Playwright。mocked-API 浏览器只验证交互；创建→触发→Workflow/Job/Pipeline 状态→故障恢复须有真实后端证据。此次文档交付没有执行新的业务运行或修改用户环境。

历史实施进度（2026-10-14，后续状态以顶部批次记录与下方当前入口说明为准）：已移除“流水线定义”侧栏入口；当时旧路由重定向到作业定义；作业详情消费后端 `/meta/pipeline-stages` 并按 Job 类型显示只读阶段；后端契约返回默认单作业 Workflow ID 和 Workflow 的 Job 关联，工作流列表可按 Job 编码和单作业/组合类别过滤，作业详情展示默认/组合工作流类型并可跳转。受管单作业图在前端以只读形式打开。新建 Job 表单过滤历史 `WORKFLOW` 包装类型，但存量 Job 仍可读取/展示。旧 Workflow Pipeline 深链暂时按 Job 编码跳转。后端租户 Pipeline 定义 POST/PUT/启停 API 已转为只读错误，历史查询保留；配置包 Apply 与批量初始化现在把旧阶段业务参数转换为 Job 默认参数，冲突和不支持的值失败关闭，Apply 不写 Pipeline 定义表。新生成的配置包导出及完整/场景模板已不再提供 Pipeline 定义/步骤表；旧包预览仍保留兼容转换。跨租户 Config Sync/Job Bundle 不再读取或传输 Pipeline 定义，配置矩阵移除 Job-Pipeline 关联列；模板/通道引用从 Job 参数解析。旧版初始化请求仍有明确的 Pipeline 转换兼容路径。初始化响应和前端 API 类型能表达 migrated 结果。Workflow 定义列表已有显式顶层运行、调度编辑与暂停/恢复入口；依赖作业按租户 Job 编码选择，旧依赖值保留供清理。Job 快速新建固定 MANUAL；Job 编辑不显示或提交 Workflow 所有的旧调度字段，后端 Job 更新 API 对变化的旧调度字段返回 `STATE_CONFLICT`。Job 详情把历史调度值标记为兼容信息并引导维护关联 Workflow；新建向导把调度配置明确标为受管单作业 Workflow 的初始计划。Workflow 的 Job 关联和定义菜单继续独立联动。设计器不再新建 FILE_STEP，也不再从租户 Pipeline 定义列表选择节点；残留 FILE_STEP 组件现仅用于历史只读展示，不加载 Pipeline 选项且不可编辑/删除。后端 V244 将存量 live 节点引用转换为同租户 JOB，并在有活动运行时、跨租户引用或目标 Job 不存在时拒绝迁移。Workflow 运行节点表已增加 Job Instance 深链，后端有节点关联时可展开到独立执行明细；V245 新增节点运行与 Job Instance 的持久关联，历史未关联行仍显示为空。**Workflow Run 详情现可按节点展开关联 Job Instance，并按需分页展示分区和 Pipeline 阶段状态/观测深链；每组最多显示 20 条并标出已加载数与总数，完整操作仍进入作业实例详情。**前端全量 typecheck、lint 与单元测试（150 个文件/885 项）通过。本轮 UI 仍缺真实浏览器交互验证。旧 WORKFLOW 转换、完整存量迁移、恢复联动和真实端到端旅程仍未完成。

进度更正（2026-10-14）：上述状态段中“前端暂不提供该入口”已被后续实现覆盖。Console 已提供受权限保护的 `POST /api/console/workflow-definitions/{id}/trigger`；列表“运行”操作选择业务日期并请求此入口，成功后跳转到返回的 Workflow Run。后端定向测试 15 项、`make check-openapi`（407 routes）、前端 API 类型生成、`npm run typecheck` 和目标 ESLint 已通过。该证据尚不等于真实浏览器或 Trigger→Workflow Run 端到端验收；Workflow 运行详情、恢复联动和调度编辑仍未完成。

调度进度更正（2026-10-14）：后端现在使用 `tenantId:WF:workflowCode` 作为 Quartz 身份，允许组合 Workflow 不关联包装 Job 直接定时注册；Trigger 按 Workflow ID/code/version 发起根运行，并提供 WorkflowCode 的注册/暂停/恢复管理 API。旧 JobCode 管理入口作为兼容别名解析到显式受管 Workflow。前端已有 Workflow schedule 编辑与 pause/resume UI，Job 的旧调度值仅作历史兼容展示；完整 Quartz→Outbox→Workflow Run 及浏览器旅程尚未验证。

调度控制 UI 进度更正（2026-10-14）：后端与前端现已提供独立 schedule pause/resume API 和列表操作；只暂停定时 fire，不禁用手动/API 执行。前端尚未提供 schedule 表达式、时区、日历等配置编辑 UI；实际 Quartz→Outbox→Workflow Run 及浏览器旅程也尚未验证。

调度编辑 UI 进度更正（2026-10-14）：前端已提供 Workflow 调度设置对话框，调用独立 schedule-only API 编辑调度类型、表达式、时区、触发模式、日历与依赖作业；请求携带当前定义版本，后端 CAS 更新并写入保留现有图的版本快照。不会走全量 DAG 保存。真实定时运行、misfire 与浏览器全旅程仍未验收。

后端进度补充（2026-10-14）：Workflow Run v2 已固定 Workflow 图、节点执行参数、每个 Job 节点的 Job 定义及按 Job 类型解析的系统 Pipeline 身份；节点派发、DAG 推进和 WAIT/Sensor 消费快照，并支持无根组合 Workflow 的 Sensor 下游派发。快照完整性及节点执行定向测试 54 项、Sensor 状态机测试 13 项通过。并发编辑一致性、进程重启后的快照恢复/重放以及前端统一运行详情与恢复旅程仍待端到端验收，不代表 UI 侧已完成。

运行详情进度补充（2026-10-14）：Workflow Run 详情节点展开已实现，展示关联 Job Instance、分页分区和 Pipeline 阶段状态，并保留完整实例与阶段观测深链；分页查询/失败处理定向测试 2 项通过。前端全量验证更新为 typecheck、lint、151 个单测文件共 887 项通过。真实浏览器和后端联动旅程仍待执行。

后端入口进度补充（2026-10-14）：Console 手动触发、批量日 catch-up 与 Compensation 驱动的 BatchDay Replay 已按显式 Job→Workflow 关系进入 Workflow Run；Replay session ID 固定在执行快照并传入实际 Job Instance，保持条目终态回填。前端无需接触或伪造该调度元数据。后端定向 Compensation 单测 15 项、Workflow 节点派发 PostgreSQL 集成 7 项通过；真实浏览器旅程、恢复/重放和调度故障注入仍未完成。

Worker 关联进度补充（2026-10-14）：后端已删除 Worker 根据 `tenantId + jobCode` 查找租户 Pipeline 定义的运行时查询；Pipeline 本身、阶段观测和按已固定 legacy definition ID 加载旧队列步骤仍保留。新任务展示/运行的 Pipeline 身份继续由 Job 类型及系统目录决定。该代码收敛不构成前端真实浏览器联动验收；Workflow/Job 创建、触发、运行详情、恢复及迁移旅程仍未全部验证。

旧节点写入限制（2026-10-14）：Console Workflow 保存 API 现拒绝新写入 FILE_STEP，不再以租户 Pipeline 定义存在性作为通过条件；客户端继续对历史 FILE_STEP 只读展示，V244 迁移和旧配置包转换保留。新增 API 拒绝语义的后端定向验证 33 项通过；真实浏览器及旧包完整恢复旅程仍待完成。

节点窗口编辑进度补充（2026-10-14）：JOB 节点属性面板现从租户元数据加载批次窗口选项，并通过已有 `windowCode` 节点契约保存；空值表示不设置节点覆盖。受管单作业 Workflow 只放宽固定 JOB 节点的窗口字段，START/JOB/END 结构、Job 关联和边仍由后端锁定。表单与保存映射定向 11 项、typecheck 和 lint 通过；完整真实 API 保存/重新加载浏览器旅程仍未执行。

运行跳过原因展示（2026-10-14）：节点明细按后端 `skipReasonCode/skipReason` 显示条件未命中、上游失败/跳过、人工跳过等原因，并为无原因字段的历史运行提示“原因未记录”；新增纯逻辑覆盖 4 项，前端 typecheck、目标 ESLint、i18n 5594 keys 对齐与文档检查通过。后端 Console 集成测试已从空库迁移至 V250（4 项通过），Workflow 节点 PostgreSQL/Kafka/MinIO/Valkey 集成测试 9 项通过；真实浏览器端到端仍未验收。

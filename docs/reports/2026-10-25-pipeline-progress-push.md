# WDI Pipeline完整快照推送与真实传输复核

本批继续[17项实施矩阵](../engineering/backend-capability-alignment-plan-2026-10-25.md)中的P00/P01/P02。前后端均为`fix/wdi-current`，HEAD分别`662d254`/`f3d5e400d`，包含既有未提交工作区；保留原改动，没有提交、推送或PR。整体目标没有缩减为本批进度页。

## 落地变化

- 新增`GET /api/console/pipeline-progress`与`/events`，以租户和当前页Pipeline ID集合（1至100个、去重排序）取得完整快照。后台共享变化采样、无订阅停止；事务内设置RLS，不依赖请求线程身份。缺对象或越权失败，不把部分失败包装成完整成功。
- 快照提供运行状态、运行保存的系统Pipeline版本、可信阶段目录与各阶段最新尝试。未知版本/未知阶段保留实际记录，不用当前字典回填历史图；历史步骤表保持服务端分页，不将新尝试插入旧页。步数与行数均不由前端计时猜测。
- 前端移除dirty事件刷新与30秒固定轮询，使用`useLivePipelineProgress`共用快照生命周期：初始/重连/reset读取，在线直接应用推送，断线退避。运行列表、当前阶段和历史表中同一步骤的状态/行数同步；范围切换清空旧样本、关闭旧流、拒绝跨租户迟到响应。旧单实例查询仅留作兼容，当前页文件摘要也走新完整快照。
- Job运行阶段计数持久为空时，按同一步骤ID和尝试序号复用实时补值；已有持久值不被缓存覆盖，终态步骤、Job根或Pipeline根不吸收迟到缓存。两条根终态回归分别暴露了新补值路径继续读取迟到缓存的问题，已修复并复测。

## 实际证据

浏览器夹具先失败：旧页面始终显示查询的3，无法直接消费推送的88；迁移后通过，且未请求旧进度端点。后端当前23项定向（含真实PostgreSQL映射），前端6组44项，Job/Pipeline/Workflow浏览器夹具3项通过。类型、i18n、ESLint、构建、fixture事实源、API类型漂移和Controller/OpenAPI路径核对按本批命令执行；新目录为429操作/381路径。

正式真实传输入口：`E2E_SKIP_GLOBAL_SETUP=1 npm run test:e2e:pipeline-progress:real`，配置与授权边界见[夹具说明](../../e2e/fixtures/runtime-progress/README.md)。持有WDI生命周期锁构建/重启Console，保持原本已启用的真实认证，不写`.env`；前端为固定构建preview。使用随机临时管理员/租户管理员与独占租户，不借用共享管理员，不保存密码、Cookie或票据。

SQL只准备/推进本例Pipeline、阶段和checkpoint：RUNNING/3→SUCCESS/88。真实HTTP、EventSource、页面及SQL独立回读验证完整状态变化，越租户403，在线4.5秒跨两个采样周期无周期GET；精确清理后Pipeline、步骤、位点、租户与临时身份残留为0。公开证据：[DTO与投影](assets/pipeline-progress-2026-10-25/pipeline-progress-real.json)、[独立零残留](assets/pipeline-progress-2026-10-25/pipeline-progress-cleanup.json)、[真实页面](assets/pipeline-progress-2026-10-25/pipeline-progress-real.png)。

## 尚未关闭的真实业务范围

该真实场景由SQL改变状态，没有Worker处理文件，不能称为Worker执行或恢复验收。Job缓存补值的单测使用Orchestrator桩；真实传输场景使用持久checkpoint，不证明源缓存已按认领/租约隔离。代码核查发现Orchestrator按任务心跳和TTL聚合，下一步需要验证并补齐失租/旧任务剔除及真实Worker处理闭环。真实Quartz计划覆盖联动和其余G01–G12/B01保持原范围，不因本报告关闭。

额外关联/诚实展示修复：指定Pipeline深链原先仅作为模糊keyword，切换标签会清空条件；现以精确ID查询列表/步骤，保留标签范围，手动重置仍可解除筛选，文件摘要随选定实例和推送更新。夹具新增查询参数断言，曾暴露标签丢失ID并在修复后通过。ETA回归先复现rowsProcessed=null仍显示3分钟，再改为未知；历史采样不能让缺失计数变成0。

最终验证命令包括：后端Maven定向`PipelineProgressQueryServiceTest,JobExecutionQueryServiceTest,ConsoleFilePipelineProgressBridgeTest,JobStepInstanceRelatedPipelineMapperIntegrationTest`、前端六文件Vitest、固定构建上的三个页面夹具和独立真实传输入口；Spotless、类型、i18n、ESLint、fixture事实源、API漂移及429条路由对齐均单独记录。真实服务复跑含新接口匿名401、租户管理员同租户200/越租户403、在线4.5秒无周期GET和精确零残留。Worker、源缓存失租隔离与Quartz仍未由本批关闭。

最终机器摘要与先红后绿边界见[验证摘要](assets/pipeline-progress-2026-10-25/verification-summary.json)。当前固定构建已复跑真实传输入口通过，0跳过、0重试、SQL及临时账户残留为0；该结论仍不覆盖Worker业务执行。


## 续接验证：源认领围栏、跨服务尝试隔离与 Workflow 当前阶段

两仓仍为 WDI `fix/wdi-current` 当前工作区（FE `662d254`、BE `f3d5e400d`），本轮没有提交、推送或重启运行服务。图表承接位置已核对当前代码：运维总览首页嵌入租户业务日五层统计，作业详情嵌入阶段图与分区/任务进度，Workflow 运行详情与运行 DAG 页复用冻结执行图。

实现补齐：

- Worker 从原始执行上下文携带认领与阶段 ID；注册表以其隔离，旧执行清理不删除新执行。
- Orchestrator 只投影同租户当前有效认领、未失租且匹配 Worker 的运行任务；Job/Pipeline 终态、Task 终态、dry-run、阶段旧尝试及缺身份样本均不作为实时补值。空心跳不删除带身份的新样本，同一次阶段迟到较小计数不回退。
- 内部聚合返回实际采用的阶段 ID，Console 再核对自身持久步骤 ID；读取期间切换尝试时保留未知，避免把新计数写入旧快照。
- Workflow 文件节点显示实际 Pipeline 阶段；存在 Pipeline 但无活跃阶段时不回退技术别名。普通作业仍显示技术步骤。
- 真实 PG 发现同事务重复读取的 MyBatis 本地缓存影响；租户上下文查询刷新本地缓存，测试每轮重新建立读取范围。

证据与边界：

- 首次目标红灯：Workflow 预期 `LOAD`、实际 `WORKFLOW_JOB_ALIAS`，见 `/tmp/wdi-wf-stage-red.log`；跨服务期望不补值、实际误填其他尝试的 `999` 行，见 `/tmp/wdi-progress-attempt-red.log`。
- 最终 Maven 定向结果 **64 tests / 0 failures / 0 errors / 0 skipped，BUILD SUCCESS**，见 `/tmp/wdi-progress-attempt-green.log`：缓存11、SDK wire12、真实PG认领1、Worker控制器9、Worker注册表3、Console桥接10、Job查询8、响应序列化5、Job/Pipeline关联真实PG4、Workflow映射真实PG1。
- 命令为 `./mvnw -o -ntp -pl batch-orchestrator,batch-worker/core,batch-console-api -am -Dtest=PipelineStageProgressCacheTest,PipelineStageProgressRegistryTest,PipelineProgressClaimMapperIntegrationTest,JobStepInstanceRelatedPipelineMapperIntegrationTest,WorkflowExecutionMapperIntegrationTest,SdkWireContractTest,WorkerControllerTest,ConsoleFilePipelineProgressBridgeTest,ObservabilityMapResponseJacksonTest,JobExecutionQueryServiceTest -Dsurefire.failIfNoSpecifiedTests=false -DforkCount=1 test`，在仓库生命周期锁内执行；变更 Java 已做限定文件 Spotless 格式化。
- Console/OpenAPI 路由校验通过429操作；内部 OpenAPI YAML 解析通过；前端 `npm run check:docs` 通过74个当前文档。
- 全工作区 `check-empty-checks.py` **未通过**，见 `/tmp/wdi-progress-empty-checks.log`；涉及既有进度代码及并行通知/SDK/SLA改动，仍须按文件所有权收口，不能把本轮定向通过称为整仓门禁通过。
- 以上真实PG用于验证 Mapper 和缓存读取规则，**没有执行真实 Worker 业务或 Quartz 日调度**；运行中的服务包仍为此前版本。本批不关闭17项总体功能与正式验收分母，下一步仍需实际 Worker、故障恢复、Quartz 及剩余功能/API 的闭环。

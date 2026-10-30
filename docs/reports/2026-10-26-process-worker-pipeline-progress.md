# PROCESS 双库阶段进度与中断恢复真实联调（2026-10-26）

## 范围与状态

本轮继续WDI主实施矩阵P01／P02，使用前后端`fix/wdi-current`当前未提交工作区。前端HEAD`662d254e2f8b97f93021de548815470d2291c997`，后端HEAD`f3d5e400d3b5bd737124b57cf0a38e685432aab2`。后端维护模式源码晚于旧运行包，本轮先由正式`bash scripts/local/build-apps.sh`重建8个运行包，构建退出0；日志`/private/tmp/wdi-process-current-build.log`。构建不等同业务验收。

真实验收入口`E2E_SKIP_GLOBAL_SETUP=1 npm run test:e2e:process-worker-progress:real`，第五轮真实Chromium 1/1、0重试通过，隔离runner退出0。使用独立平台／业务数据库、Kafka命名空间、临时认证身份、PROCESS Worker和18181／18182／18183／5181端口，不启停共享服务。本证据覆盖`sqlTransformCompute`代表链，不外推其他插件、外部渠道或生产发布。

## 验收条件

- 正式PROCESS Job使用`sqlTransformCompute`及`systemPipelineStepParams.COMPUTE`；源、暂存和目标均在独立业务库，平台任务／Pipeline保持另一物理库。业务库通过正式bootstrap在本例新空库初始化，Worker使用非超级`batch_business_writer`，不修改共享角色凭据。
- 本例业务源表600条记录加另一租户哨兵；强制RLS下业务角色只读到600条。正式WAP链为PREPARE→COMPUTE→VALIDATE→COMMIT→FEEDBACK，COMPUTE实际落暂存，COMMIT真实INSERT被本例目标表触发器有界延长，未用SQL推进运行状态。
- 在实际COMMIT查询、目标表仍0行且暂存600行时，只SIGKILL本例保存的Worker句柄。重启同一身份，等待真实租约回收及续跑；最终目标600个唯一键，每行金额为源金额两倍，总额450750，无跨租户行。
- Job详情显示五阶段、COMMIT位置、已知COMPUTE计数；Pipeline观测的完整快照也应显示当前阶段。终态原Job、Pipeline及父Workflow正确关联，没有遗留RUNNING尝试；旧中断尝试与新成功尝试分别保留。
- 浏览器在线空闲时不周期GET。业务与平台分别按本例租户、批次、随机表名和保存ID清理，再独立查询各库租户表残留，不能仅凭删除父记录推断成功。

## 实现与证据边界

复用`WorkerExecutionProgressFixture`的真实认证、独占进程、已保存Job定义及终态清理；扩展Worker类型选择和显式SQL目标数据库，Atomic默认路径保持原行为。新增五份SQL分别承担业务输入准备、业务回读、平台回读、业务清理和平台Pipeline清理。首次离线发现命令缺`E2E_SKIP_GLOBAL_SETUP=1`而按守卫拒绝，修正命令后发现1项用例；不将发现或跳过计为真实通过。

最终第五轮运行日志`/private/tmp/wdi-p01-process-progress-real-5.log`，服务日志目录`/private/tmp/wdi-p01-process-progress-20261026140650`，原始成功结果`/private/tmp/wdi-process-fifth-passed-results.json`；[脱敏证据](./assets/process-worker-progress-2026-10-26/real-evidence.json)、[COMMIT在途页面](./assets/process-worker-progress-2026-10-26/job-commit-running.png)和[恢复后页面](./assets/process-worker-progress-2026-10-26/job-recovered.png)已保存，两图人工检查无遮挡、计数及阶段可见。本轮不因PROCESS通过推断DISPATCH或外部渠道、生产发布已完成；总状态见[主实施矩阵](../engineering/backend-capability-alignment-plan-2026-10-25.md)。

首轮在业务准备SQL输出JSON前额外输出`set_config`返回值，导致适配层解析失败，未创建Job或启动Worker。平台夹具30项清理为0，但业务准备已提交，故不宣称双库清理全0；原始结果保留于`/private/tmp/wdi-process-first-failure-results.json`，本例双库诊断后已精确删除。已改为psql变量静默设置，未改运行断言或生产行为。

第二轮Worker启动被RLS closed-world校验正确拒绝：新业务库已创建表，但缺少`process_staging`及其默认分区的ENABLE／FORCE／strict策略。作业尚未触发，平台、业务及全租户表清理计数全部为0；原始结果保存为`/private/tmp/wdi-process-second-failure-results.json`，两份隔离库诊断后已精确删除。第三轮从后端权威`scripts/db/business/rls-phase-a.sql`提取完整表级策略段，在新业务库的事务内执行；跳过其集群角色初始化段，避免修改共享角色，保留Worker启动检查。共用夹具启动错误改为实际Worker类型并保留底层原因。

第三轮实际运行到COMMIT，COMPUTE／VALIDATE输出摘要各有600条，但Job阶段行仍显示空值，严格页面断言失败，尚未注入进程中断。根因是Console进度Mapper仅投影`pipeline_progress`，遗漏PROCESS成功阶段的正式计数摘要；新增真实PostgreSQL回归已先失败（期望600，实际null）。修复同时作用于Job与Pipeline读模型，COMMIT按实际发布数，其余按处理数；只接收安全非负Long整数。原始结果保存于`/private/tmp/wdi-process-third-failure-results.json`；双库清理计数全0，隔离库已删除。修复后的定向测试与真实复验仍进行中。

修复后`ConsoleFixedProjectionMappingIntegrationTest,ConsoleFilePipelineProgressBridgeTest,JobExecutionQueryServiceTest`合计24项通过、0失败／跳过，包含真实PostgreSQL、当前运行不继承旧成功计数、发布0条与无效计数保持未知；日志`/private/tmp/wdi-process-count-green.log`。正式运行包重建退出0，日志`/private/tmp/wdi-process-count-fixed-build.log`，第四轮基于新包重跑。前端本轮格式、ESLint、403文件测试事实来源、75份当前文档与Changelog检查通过，测试Skill结构校验通过；不继承上一轮完整应用门禁为本批最终结论。

第四轮仍在同一Job页面计数断言失败：Pipeline查询已修正，但Job另有独立`selectStages`持久查询，实时桥仅为RUNNING步骤补值，成功步骤没有复用Pipeline结果。上一批24项回归未覆盖该独立Mapper，因此不能据其关闭Job显示缺陷。已向真实PostgreSQL回归补入Job查询的0条、当前运行未知、成功600条及跨租户断言；两处查询改用共享SQL计数片段，避免重复规则。该轮51项清理计数全0、双库已删除，原始结果保存于`/private/tmp/wdi-process-fourth-failure-results.json`；仍未执行中断恢复。

Job查询的新增真实PG断言先失败，日志`/private/tmp/wdi-process-job-count-red.log`。共享片段修复后首次回归的末次读仍命中测试事务中由JDBC准备前的MyBatis一级缓存；按已有日统计测试方法清除该测试缓存后，完整24项定向回归通过、0失败／跳过，日志`/private/tmp/wdi-process-job-count-green-2.log`。生产缓存配置及事务边界未改变，新包正通过正式构建入口重建；最终浏览器复验与中断恢复尚未通过。

## 最终真实结果

正式重建退出0（`/private/tmp/wdi-process-job-count-fixed-build.log`）后，第五轮1/1通过、0重试。COMPUTE／VALIDATE成功600条，页面实时显示600；COMMIT真正执行时业务角色为`batch_business_writer`、目标仍0、staging600；源表原始601条含跨租户哨兵，RLS业务角色只见600。只SIGKILL本例Worker，重启同一身份后由真实租约回收启动第二次COMMIT。

最终同一Job与Pipeline SUCCESS，目标600个唯一业务键逐条金额正确，总额450750，其他租户写入0。旧COMMIT runSeq1为FAILED／PIPELINE_ATTEMPT_INTERRUPTED，新COMMIT runSeq2 SUCCESS，无遗留RUNNING步骤；Job五阶段和父Workflow四节点均成功，Pipeline终态推送到达。在线观察4.5秒无周期GET。

双库清理与全租户残留检查共51个计数全部0，临时Worker和四服务停止，成功双库删除；另行查询本任务五轮PROCESS库剩余数为0。DISPATCH及文档站体积整改仍开放。

共用夹具的Atomic路径随后独立真实复验1/1、0重试通过：作业／父Workflow DAG、租户日统计及在线无周期GET均由原正式用例核对，30项清理全0；[精简证据](./assets/process-worker-progress-2026-10-26/atomic-shared-fixture-regression.json)。隔离runner退出0，原始结果`/private/tmp/wdi-atomic-shared-fixture-passed-results.json`，日志`/private/tmp/wdi-atomic-shared-fixture-regression-real.log`。Atomic与PROCESS本任务隔离库合计残留0，四临时端口独立检查全部释放。最终受影响门禁随DISPATCH及文档站整改后复核，不以本轮回归代替整体发布验收。

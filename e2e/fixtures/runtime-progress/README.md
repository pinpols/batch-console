# 运行DAG与租户当日进度真实验收夹具

入口：`e2e/runtime-progress-real.spec.ts`。使用独占UUID租户、临时管理员/租户管理员，业务动作走真实API，数据库独立回读运行/节点/终态Outbox。这里不创建Worker任务，不覆盖定时计划生成或真实文件Pipeline。

先核对前后端均为目标WDI工作树、运行包与当前源码一致、真实认证已启用（匿名`/auth/me`返回401），并取得后端本地生命周期锁协调构建/重启与验收。前端使用固定构建preview；不要对其他任务服务启停。

设置目标环境的`E2E_BASE_URL`、`E2E_CLOSURE_PG_CONTAINER`、`E2E_CLOSURE_PG_USER`与`E2E_CLOSURE_PG_DATABASE`后运行：

```bash
E2E_SKIP_GLOBAL_SETUP=1 npm run test:e2e:progress:real
```

`fixture.ts`复用Workflow批量夹具的租户、日历、独立状态回读和按数字身份清理；`PasswordHash.java`从配对后端`build/runtime-jars/console.jar`提取正式密码实现及依赖生成临时密码hash，需要Java、unzip与Docker/psql。密码仅经临时子进程环境传入，不输出到报告；用例关闭trace，截图只捕获已登录业务页。

`sql/credentials-prepare.sql`创建本例两个随机身份，保存返回数字ID；`credentials-cleanup.sql`仅删除同时匹配ID与随机用户名的账户，再独立核对残留。先收敛运行、注销、删除身份，再调用批量夹具精确清理；遇到活跃运行或意外Job副作用时拒绝删除。失败与清理失败同时保留，不能将父记录消失当作清理成功。

输出包含运行与日统计截图、公开推送DTO、SQL状态、在线无周期GET观察及零残留计数。控制DAG用例以手工业务日期创建 START→WAIT→END；ADMIN真实API暂停/恢复、TENANT_ADMIN被拒，UI由全快照SSE更新冻结节点。它不创建Job/Worker，不能证明Quartz；本用例通过真实浏览器点击详情页暂停/恢复按钮并确认，以SSE断言状态变化。`--list`只证明测试可发现，开关未启用的跳过不计业务通过。不要将临时凭据、Cookie或连接票据保存到版本库。

## readiness 与容量持久等待查询验收

`E2E_SKIP_GLOBAL_SETUP=1 npm run test:e2e:persistent-waits:real` 使用 `PersistentWaitFixture`。SQL夹具只插入本例随机租户、Workflow ID 和随机请求号下的 readiness/容量等待记录；容量行包含一个仅供脱敏检查的私有载荷标记，Console响应和截图不得包含该值。查询经过真实 Orchestrator PostgreSQL Mapper 与 Console BFF，UI在现有“调度快照”持久等待页签展示两类记录，并检查 ADMIN、TENANT_ADMIN、AUDITOR 可读，TENANT_USER/匿名拒绝以及租户用户越租户403。清理按已保存Workflow ID、随机请求号和用户名精确执行，父夹具再删除触发请求、Workflow、账户、日历和租户，全部残留必须为0。

`E2E_SKIP_GLOBAL_SETUP=1 npm run test:e2e:scheduler-waits:real` 使用 `SchedulerWaitFixture`。SQL准备跨日历等待；作业等待通过真实 API 创建上下游作业定义，再触发包含下游作业节点的 Workflow DAG，由 Orchestrator 生成并持久化关联父 Workflow 的 `trigger_request` 与等待记录，且不建立 Job 实例。浏览器在现有“调度快照”页验证两类等待，并由 ADMIN 提交带原因的 `SKIP` 请求；随后隔离日期分别让调度器消费 `SKIP` 和 `RELEASE`：回读前者的等待/批次日均为 `SKIPPED`，后者等待为 `OPENED`、批次日为 `OPEN`，并验证操作理由和操作者持久化。另核对 TENANT_ADMIN/AUDITOR只读、租户用户和匿名拒绝、租户管理员越租户拒绝及作业载荷不泄露。清理先删等待、批次日与操作审计，再由父夹具终止Workflow并删除父子触发请求、定义、账号、日历和租户，最后检查零残留。

`E2E_SKIP_GLOBAL_SETUP=1 npm run test:e2e:manual-upload:real` 使用 `ManualFileUploadFixture`。运行包密码哈希默认取 `build/runtime-jars/console.jar`；当验收服务使用独立构建包时，通过 `E2E_CONSOLE_JAR` 指向同一 WDI Console JAR，避免旧运行包哈希器与本次代码不一致。本例经 SQL 夹具准备唯一的 START→END Workflow、文件组绑定和 IMPORT 模板；真实 ADMIN 在文件页选择通道、目标组、业务日、必需文件和模板，再上传唯一 CSV 到 MinIO。验收在内容 PUT 完成后拦住到达确认，跨过一次 30 秒文件组扫描周期，独立确认 `file_record` 已含绑定元数据且未提前创建 Workflow 运行；放行确认后等待文件组调度器创建并完成一个真实 Workflow，再核对对象字节、`file_record`、`file_audit_log` 和持久运行状态。TENANT_ADMIN 页面保留上传入口；AUDITOR/TENANT_USER 入口隐藏且真实上传会话请求返回 403。finally 根据唯一对象键删除本例 MinIO 对象，再精确清理文件/审计/通道/文件组/模板/额外角色账户，父夹具随后删除预期工作、Workflow 运行和租户；所有残留计数必须为 0。

## Atomic 执行器运行态真实验收

入口为`e2e/atomic-runtime-real.spec.ts`与`npm run test:e2e:atomic-runtime:real`。除指定本说明顶部的PostgreSQL容器/账号/数据库和WDI前端地址外，必须显式设置`E2E_ATOMIC_RUNTIME_MODE=available|unavailable`并启用真实认证。`available`模式还须将`E2E_ATOMIC_WORKER_URL`指向实际Atomic Worker；`unavailable`模式要求Console真实配置`batch.console.atomic-worker.enabled=false`。用例核对Worker Actuator与Console反查、ADMIN/TENANT_ADMIN/AUDITOR/TENANT_USER读取权限，以及禁用时的降级提示和明细表隐藏；每次只创建独占身份/租户并精确清理。证据按`Asia/Shanghai`本地日期写入`docs/reports/assets/atomic-runtime-YYYY-MM-DD/`。

## Pipeline真实传输与SQL投影夹具

`E2E_SKIP_GLOBAL_SETUP=1 npm run test:e2e:pipeline-progress:real` 显式启用独立的`E2E_PIPELINE_PROGRESS_REAL`场景，环境、真实认证、生命周期锁和临时身份要求同上。`PipelineProgressFixture`只准备独占Pipeline与步骤/checkpoint，SQL从RUNNING/3推进到SUCCESS/88，浏览器不设路由桩，验证真实服务完整SSE快照、权限与在线无周期GET。这里没有Job、Worker执行或真实文件处理，不计Worker业务验收。

`pipeline-prepare.sql`返回保存的Pipeline/步骤数字身份；`pipeline-advance.sql`只更新保存身份且命中租户的行；`pipeline-cleanup.sql`精确删除步骤、位点和Pipeline，再用租户与数字身份独立检查零残留。随后沿用账户及租户清理。SQL失败或清理失败不会转成跳过或通过；输出只保存安全DTO、截图与残留计数。

## Atomic Worker 作业进度真实验收

`E2E_SKIP_GLOBAL_SETUP=1 npm run test:e2e:worker-progress:real` 启动本例独占租户的临时 Atomic Worker，使用独立 Kafka consumer group 与 `TENANT_SCOPED` 订阅；作业定义和 Workflow 通过真实 Console API 创建并触发，Worker 真正执行只读 `SELECT pg_sleep(...)`，由 Orchestrator 回报实例、分区和任务状态。浏览器不使用路由桩，验证运行 DAG、作业详情的 SSE 快照、租户当日进度图表/分项表及在线期间没有周期 GET。DAG显示关联Job实例状态，同时保留Workflow节点自身状态，不把显示状态写回调度模型。`E2E_ATOMIC_WORKER_JAR` 可指向本地单独构建的 Atomic Worker 包，未设置时使用标准 `build/runtime-jars/worker-atomic.jar`。

启动前确认本地 Worker JAR 与 WDI 源码一致、当前工作树本地生命周期锁空闲、真实认证开启、数据库/Kafka 健康，且 E2E 指向 WDI 前端预览和后端。夹具关闭临时 Worker 后仅按独占租户、随机编码和已保存数字身份删除本例运行记录；先确认关联Workflow运行已终态，再清除节点与单作业Workflow的外键引用，最后删除Job并由父夹具清理Workflow/租户。活跃任务或运行会拒绝删除。截图和 JSON 附件不包含 SQL 参数、认证凭据、Cookie 或 Worker 日志。

## PROCESS 双库WAP与进程恢复验收

新业务库还须应用权威`rls-phase-a.sql`的表级strict策略，包含staging父表、叶分区及generation账本；不能跳过Worker closed-world检查。共享集群复用已有非超级业务角色，不执行角色修改段。

PROCESS使用`E2E_SKIP_GLOBAL_SETUP=1 npm run test:e2e:process-worker-progress:real`，额外要求显式`E2E_PROCESS_BUSINESS_DATABASE`，与平台库必须物理分离，名称由本例隔离runner创建。业务库先用后端正式`create_biz_tables.sql`在本例新空库建立WAP暂存结构，再授予本例所需业务角色访问；不能运行含固定`\connect batch_business`的Docker初始化脚本去接触共享库。`ProcessWorkerPipelineFixture`只准备独占RLS源／目标及有界COMMIT延迟，实际运行走正式PROCESS插件。确认目标发布SQL正在执行后才中断保存的Worker，恢复后核对每条业务记录、金额、旧／新阶段尝试及完整SSE。终态与源查询收敛后分别清理两个库，再独立检查各库本例租户残留。

## DISPATCH 真实传输与未知结果审批恢复

使用仓库明确识别的`e2e`非生产profile并显式开启认证；自定义未知profile会按生产规则验证凭据，不应为启动而关闭守卫。上传返回时保存文件数字ID和对象bucket／path，后续分发可能改变元数据`channelCode`，不能再用原渠道匹配源文件或清理对象。DLQ审批执行成功的正式终态为EXECUTED，授权消费与业务完成仍须分别回读。

`E2E_SKIP_GLOBAL_SETUP=1 npm run test:e2e:dispatch-worker-progress:real`要求独占平台库、对象／Kafka namespace及本地真实对象上游`E2E_DISPATCH_OBJECT_UPSTREAM`。`DispatchWorkerPipelineFixture`启用真实NAS适配器（不能使用local／test profile的stub），目标仅本例临时目录。代理透传本例真实对象GET并有界限速，不保存签名头；实际部分临时文件出现且最终文件／sidecar未发布时才中断保存的Worker。外部结果未知必须先阻断自动重投；独立核实未发布后由ADMIN经综合查询死信页申请、另一身份审批恢复，核对一次性授权、原失败保留、唯一分发记录、完整字节／SHA／manifest／回执及Job阶段。SQL只读回和终态精确清理，NAS目录和对象由本例收尾；本地NAS适配器验证不外推外部挂载或SFTP。

## IMPORT 对象文件与进程恢复验收

独立回读按 bucket＋对象路径跨租户统计文件记录，防止默认租户对象对账生成第二条记录。运行中还要核对页面 LOAD 行实际显示的已处理记录数，不能只检查 SSE 内容。历史尝试与当前尝试分别断言，Job 终态不应留有旧 RUNNING／RETRYING 尝试。

`E2E_SKIP_GLOBAL_SETUP=1 npm run test:e2e:import-worker-progress:real` 使用 `ImportWorkerPipelineFixture`，要求独占WDI服务、数据库、Kafka/对象命名空间以及显式 `E2E_OBJECT_STORAGE_NAMESPACE`。通过真实上传会话写入CSV对象、确认到达，再经Workflow `payload`中的 `bundleFiles`引用原文件。临时IMPORT Worker只订阅本例租户，实际运行固定IMPORT Pipeline；SQL只创建有强制RLS策略的独占业务目标表、读取checkpoint/业务行和精确清理，不写任务或阶段终态。

业务目标表的测试触发器仅延长本例INSERT，以便观察LOAD进行中状态。在实际checkpoint落库后，测试只停止自己保存的Worker子进程，再启动同一身份，等待Orchestrator租约回收与续跑。核对原文件/Job/Pipeline关联、阶段尝试、真实SSE、业务行不重不漏和零残留；不能用这个场景推断其他Worker类型或所有恢复路径。服务端租约窗口须覆盖Worker续期间隔并与本例等待预算一致。失败先附加持久状态，临时Worker始终停止；活跃业务副作用未收敛时清理失败并保留隔离库供诊断。

## Workflow 失败节点重放验收

整轮Workflow与EXPORT恢复使用 `E2E_SKIP_GLOBAL_SETUP=1 npm run test:e2e:whole-workflow-replay:real`。`ExportWorkflowReplayFixture`准备带强制RLS的独占批次／明细表、受限只读视图与`jdbc_mapped_export`模板；只读视图延迟用于观察GENERATE，不写执行状态。真实Worker能力声明必须完整一致，没有在线Worker时预览阻断；经平台管理员提交和另一租户管理员审批后才创建新目标。当前定义改变后仍使用原冻结图；仅对目标Worker保存句柄注入中断，核对checkpoint、独立文件内容／SHA、原产物不变和零残留。临时对象按部署命名空间隔离，并按精确bucket/path删除；严禁修改registry声明制造准入。

EXPORT Worker使用本例独立`java.io.tmpdir`，在本例重启间保留，避免不同隔离库相同Pipeline ID误用其他运行的临时文件。延迟视图必须保持分页按页读取，不能把全表排序前的延迟误当作续跑；源查询退出、运行终态后才删除本例关系及临时目录。共享`worker-progress-state.sql`要求调用方提供保存的`job_definition_ids`，扩展时同时检查Atomic、IMPORT与EXPORT调用方。

多定义双日历日统计使用 `E2E_SKIP_GLOBAL_SETUP=1 npm run test:e2e:multi-calendar-progress:real`，要求本例Trigger启用真实Quartz。`MultiCalendarProgressFixture`准备第二日历；`multi-calendar-progress-state.sql`独立回读全部定义、原始occurrence、水位、业务日、请求与根运行。三个定义分别是两条单次CRON及一条86400秒FIXED_RATE，预计CRON约两分钟后触发，执行窗口应避开日历cutoff与跨日；不得为赶时长修改Quartz表。当前日及次日投影分别检查，缺少未来业务日cutoff时计划比例保持未知。清理先逐一关闭保存的全部定时定义，再精确移除每个定义的计划／水位，最后按租户清理并核对全部业务表残留；不创建Job/Worker。

实际双业务Job并行／分支验收另用 `E2E_SKIP_GLOBAL_SETUP=1 npm run test:e2e:workflow-dag-branches:real` 和 `WorkflowDagFixture`。创建两个独立Job定义并保存ID；状态回读包含这两个ID，逐定义精确清理后再清理Workflow。HTTP目标均为本例随机端口／路径，只暂缓响应以观察同时运行及单侧完成后ALL汇合仍等待，不能以SQL写状态替代。条件场景带真实启动payload，核对未命中分支SKIPPED、503作业沿FAILURE边执行200处理作业、根Workflow保持FAILED。复用全租户表零残留核对，不推断所有Join模式或恢复策略已覆盖。

`E2E_SKIP_GLOBAL_SETUP=1 npm run test:e2e:workflow-node-replay:real` 使用 `WorkflowReplayFixture`，复用上述独占 WDI、PostgreSQL、真实认证和 Atomic Worker 要求。两种源图均包含分支／汇合：SQL 失败按非幂等能力形成未知结果，预览应拒绝；受控本地 HTTP GET 实际返回 503 形成已知失败，补齐业务输入后返回 200，重放仍须经过页面／服务和 Worker。使用既有 local HTTP 出站白名单，不放宽生产规则。

平台管理员在失败节点申请重跑，另一具备审批权限的租户管理员在审批页批准后应创建新的执行，源运行保持失败。租户管理员的申请入口隐藏，直接预览 API 返回 403。核对精确源节点／Job／目标运行、审批发起人与批准人、完整快照推送和页面图；审批受理或补偿命令成功不能代替目标执行成功。清理先等重放及执行终态、关闭本例 Worker、处理精确副作用，再独立回读本例租户在业务／归档表中的残留。参数与动作边界沿用本文件，不将此路径推断为所有重放策略或发布验收。

## 批次日治理真实业务夹具

`E2E_SKIP_GLOBAL_SETUP=1 npm run test:e2e:batch-day:real` 使用 `BatchDayGovernanceFixture`、真实认证和独占生命周期锁。`batchday-prepare.sql`只准备两天的初始治理状态和审计员/普通租户用户，不直接修改测试动作的最终状态。六种治理动作、补扫暂停/恢复与终态拒绝全部走真实 Console → Orchestrator API；`batchday-state.sql`独立回读持久状态、治理审计和补扫控制事件。

用例通过 `route.fetch()`实际提交第一次冻结，再中断浏览器响应，刷新页面后恢复并重试同一请求/幂等键；最终只出现一条冻结审计。这是故障注入，没有用路由桩伪造成功状态。管理员、租户管理员、审计员和普通租户用户分别验证界面/请求权限；审计员是全局只读角色，租户角色跨租户请求必须被拒绝。

`batchday-cleanup.sql`只处理已保存数字身份及独占租户的人工治理日志，遇到意外Job副作用即失败；其余批次日、补扫控制与审计沿用独占租户清理和独立零残留回读。输出仅包含状态/审计、安全截图和清理计数，不保存密码、Cookie或票据。SQL准备不计作开日/Quartz/Worker验收。

## Atomic已保存配置真实验收

`E2E_SKIP_GLOBAL_SETUP=1 npm run test:e2e:atomic-config:real` 在真实认证及独占生命周期窗口内，通过Atomic配置中心保存、修改后应用并刷新复读SQL参数预设。用例用独立PostgreSQL查询核对租户、执行器类型、参数和创建身份；ADMIN与TENANT_ADMIN允许读写，AUDITOR与TENANT_USER读写均拒绝。`atomic-config-state.sql`只读取本例4个随机名称，`atomic-config-cleanup.sql`仅按本例租户、SQL类型和随机名称删除并回读零残留；拒绝角色写入时使用的名称也纳入清理范围。证据不含凭据或Cookie，保存至`docs/reports/assets/atomic-config-YYYY-MM-DD/`。

## OIDC 身份绑定管理真实验收

`E2E_SKIP_GLOBAL_SETUP=1 npm run test:e2e:oidc-bindings:real` 使用唯一 `E2E_OIDC_TENANT_ID`，并要求隔离 Console 同时启用本地单租户 OIDC 管理配置（registration id `wdi-local`、issuer `https://issuer.invalid/wdi`、该租户 ID）。测试不访问 OIDC 登录入口，不触达外部 IdP；dummy client secret 只供本地 Spring 配置校验。前端用 ADMIN 在用户账户页绑定并解绑同租户已存在账号；另外核对 TENANT_ADMIN 的列表/绑定/解绑403、其他租户查询404、同账号冲突409、账号角色不变和绑定/失败/解绑审计。SQL状态查询核对 issuer、subject、绑定人和角色；清理只删除本例身份与唯一租户审计，之后使用已保存数字账号ID和父夹具租户精确清理。

启动 Console 前令 `BATCH_CONSOLE_SSO_OIDC_ENABLED=true`、`BATCH_CONSOLE_SSO_OIDC_REGISTRATION_ID=wdi-local`、`BATCH_CONSOLE_SSO_OIDC_TENANT_ID` 与 `E2E_OIDC_TENANT_ID` 相同，并设置本地 issuer/client/redirect 参数。身份状态与审计清理在独立 SQL 调用后另开查询确认，不能依赖同一 SQL 语句快照得出零残留。脱敏摘要写入 `docs/reports/assets/oidc-identity-YYYY-MM-DD/`。

## 结果版本治理真实验收

`E2E_SKIP_GLOBAL_SETUP=1 npm run test:e2e:result-versions:real` 在真实认证与独占生命周期窗口内运行。Console API 和批次日重放页面只呈现结果版本元数据；数据库中的原始载荷用于确认未被删除或改写，但载荷及存储引用不会进入 Console 响应。ADMIN/TENANT_ADMIN 可以提升或归档候选版本，AUDITOR/TENANT_USER 只读，租户用户跨租户读取被拒绝。SQL 只创建本例版本记录、独立回读状态/审计，并按独占租户和随机业务键清理；结束后版本、审计、账号及租户相关残留均须为零。证据只保留角色状态、审计动作/结果和清理计数，不保留临时租户或操作者标识，输出至 `docs/reports/assets/result-version-governance-YYYY-MM-DD/`。

### 取证导出

`E2E_SKIP_GLOBAL_SETUP=1 npm run test:e2e:forensic:real` 使用本例独占租户，通过真实 ADMIN 页面生成并下载取证包；核对 TENANT_ADMIN 的 403、数据库导出日志、ZIP 内三个 JSON 文件、Manifest 范围和下载 SHA-256。页面不得呈现服务端存储路径。`E2E_FORENSIC_STORAGE_DIR` 必须与目标 Orchestrator 生效的 `batch.forensic.storage-dir` 一致；清理只删除随机租户名下的导出日志和对应 `<exportId>.zip`，不递归清空存储根目录。真实验收要求 Console 的本地绕过鉴权关闭，且通过 `spring.kafka.listener.auto-startup=false` 禁止临时 Console 加入共享消费组；后端 Orchestrator 确认是当前 WDI 代码。用生命周期锁协调其它真实验收。

## 临时 Worker 启动脚本

`start-worker.sh` 统一启动本例临时 Worker：位置参数依次为后端根目录、JAR、profile、worker kind、worker code、tenant ID、consumer group；`--java-opt` 传 JVM 参数，`--` 之后是 Spring 应用参数。夹具用 `spawn('bash', [start-worker.sh, ...参数])` 传参，不把绝对路径拼进 `bash -c` 命令串；脚本在 `source scripts/lib/env-common.sh` 并加载本地 JVM 环境后 `exec java`。

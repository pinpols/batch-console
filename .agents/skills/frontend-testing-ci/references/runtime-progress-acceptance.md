# 运行进度真实验收方法

仅在验证真实运行图、Worker阶段、恢复或日程统计时加载。普通单测、门禁或文档调整使用[测试Skill入口](../SKILL.md)。具体环境与入口以[当前夹具说明](../../../../e2e/fixtures/runtime-progress/README.md)和 `package.json` 为准；这里保存调查方法和反例，不继承历史PASS。

## 运行进度真实验收

- `test:e2e:dispatch-worker-progress:real`使用真实NAS适配器与真实对象，不启用会替换NAS为stub的local／test profile。限速代理只透传本例对象并保留签名，日志不保存凭据；看到实际部分临时文件、最终文件及manifest缺失后才中断保存的Worker。未知外部结果应阻断自动重投；核实未发布后经ADMIN申请／另一身份审批恢复，分别验证授权只消费一次、源失败保留、目标字节／SHA／sidecar／回执。NAS适配器到本地隔离目录不等于外部NAS或SFTP验收。环境、边界及清理见runtime-progress夹具说明。

- DISPATCH隔离验收使用正式识别的`e2e`非生产profile并保留认证；未知profile按生产规则拒绝弱凭据是预期行为。上传时保存数字文件ID与对象身份，渠道元数据后续可变，不能靠原channelCode清理；对象删除后独立stat验证。DLQ审批成功执行后应为EXECUTED，不能停留在APPROVED即认定业务完成；Element Plus隐藏原生checkbox时点击可见label后仍断言真实checked。

- `test:e2e:process-worker-progress:real`验证PROCESS实际WAP执行，必须分离平台与业务数据库。新业务库同时应用正式表结构和strict RLS策略，覆盖staging父／叶表与generation；复用共享角色时不修改角色或凭据，不禁用Worker启动检查。确认实际COMMIT查询与暂存记录后才中断保存的Worker，恢复需独立回读目标唯一键／金额、跨租户哨兵及旧新尝试，再核对页面SSE；双库清理分别证明，不能以平台清理代替业务库清理。具体环境见runtime-progress夹具说明。

- 整轮重放使用 `test:e2e:whole-workflow-replay:real`，由真实Worker注册插件能力，分别验证无在线能力阻断、原版本冻结、不同申请／审批人和新运行独立产物；不能向registry写入能力替代注册。EXPORT中断恢复还须独立核对对象内容、SHA、checkpoint与历史尝试。隔离数据库会重复数字Pipeline ID，JVM导出临时文件也须按本例隔离，并跨本例重启保留；终态后只删除本例目录。
- 用SQL延迟构造真实Worker观察窗口时，先确认分页查询的实际执行计划仍按页读取；投影中的易变表达式可能迫使排序前计算全表。清理前等待本例残留源查询退出，避免把断开的客户端误当成服务端查询已经结束。共享状态SQL新增必填变量时，检查全部调用夹具，并复跑受影响的既有真实入口。

- 混合日程使用 `test:e2e:multi-calendar-progress:real`：真实Quartz执行多个定义、多个日历与FIXED_RATE，分别核对计划→请求→根运行及版本／日历水位。当前日与未来日期切换时保留各自分母，未来已有计划但无批次日cutoff仍应显示覆盖不足，不能由实际运行全成功推断计划总量完整。定时清理先关闭保存的全部定义；控制Workflow与真实Job／Task证据分开。截图前经页面关闭首次引导，不复制会漂移的身份／版本持久化键。

- 实际多Job分支使用 `test:e2e:workflow-dag-branches:real`，不能用控制节点并行替代业务并行证据。按冻结节点编码独立比对持久Job ID，观察两个真实任务同时执行，再依次释放外部响应证明ALL汇合等待；CONDITION未命中、FAILURE处理成功和根运行失败分别保留事实。Worker注册不等于新Kafka订阅已获得分区，首次消费应有界等待实际任务；响应观察门控也应有界，清理时释放尚未到达的请求。多Job夹具按保存的全部定义ID回读和清理，不能只清理第一个。

- 失败节点重放使用 `test:e2e:workflow-node-replay:real`：区分非幂等执行后的未知结果拒绝和已知失败的审批重放，不为通过而改写结果或放宽围栏。先展开现有节点运行记录，再核对申请入口与 Controller 权限；申请、审批执行和目标 Worker 成功分开回读，并检查原失败运行不被覆盖、图完整适配和真实位置。准备／修复 SQL 不写运行终态，清理还应覆盖失败产生的死信／告警、无实例外键日志、去重及登出记录，并独立核对本例租户残留。

- `npm run test:e2e:progress:real` 对应 `e2e/runtime-progress-real.spec.ts`，显式要求 `E2E_SKIP_GLOBAL_SETUP=1` 和独占真实环境。运行前用后端生命周期锁协调构建/重启，核对WDI运行包与固定前端产物，不切换其他工作树服务。真实控制图场景不创建Job/Worker，核对ADMIN API暂停/恢复、TENANT_ADMIN拒绝、Workflow完整SSE快照、冻结图不随定义编辑漂移及终态SKIPPED/NOT_EXECUTED；单独标记手工日期，不能声称Quartz或当前业务日计划验收。
- 使用 `e2e/fixtures/runtime-progress/` 的随机临时身份、正式运行包密码实现及独占租户，不复用共享管理员；原密码不写日志或trace。PG连接参数沿用当前closure fixture环境变量。
- 业务创建、触发、暂停/恢复、定义修改走真实API；SQL用于身份准备、独立状态/Outbox回读和按数字身份精确清理。截图、推送状态、无周期GET观察和零残留分别留证，列表发现或跳过不计验收通过。
- `npm run test:e2e:worker-progress:real` 对应 `e2e/worker-workflow-progress-real.spec.ts`，由独占租户临时启动真实 Atomic Worker；作业/Workflow 创建与触发走真实 API，经 Kafka、Orchestrator、Worker 执行，再核对 DAG 节点、Job/分区/任务、每日图表和在线无周期 GET。它是 Worker 业务闭环证据，与不创建 Worker 的控制图场景及 SQL 推进 Pipeline 场景分开记录。
- Worker 场景同样要求固定 WDI preview、真实认证、空闲生命周期锁、显式 `E2E_CLOSURE_PG_CONTAINER/USER/DATABASE`。SQL 只独立回读和按随机租户/编码/已保存身份精确清理；先确认 Worker 与运行终态，活跃副作用会阻止删除。

- Pipeline完整快照的真实传输入口为`npm run test:e2e:pipeline-progress:real`。`e2e/fixtures/runtime-progress/sql/pipeline-{prepare,advance,cleanup}.sql`只驱动独占SQL投影变化，必须与真实Worker业务验收分开报告；SQL、完整API/SSE和浏览器真实不代表Worker实际处理过文件。该入口同样要求显式PG环境、独占生命周期窗口、真实认证和零残留证据。
- Atomic运行态门控真实验收使用`npm run test:e2e:atomic-runtime:real`，必须显式选择`E2E_ATOMIC_RUNTIME_MODE=available|unavailable`并设置`E2E_SKIP_GLOBAL_SETUP=1`、独占PG参数及WDI前端地址；available模式还要指向真实Worker Actuator，unavailable模式要求真实Console禁用反向查询。用例验证Console反查、四角色、降级提示/隐藏明细和精确清理；临时认证/配置必须恢复，截图及脱敏结果按`Asia/Shanghai`日期保存。详情见`docs/testing/README.md`与runtime-progress夹具说明。

- `npm run test:e2e:import-worker-progress:real`验证真实对象上传后的BUNDLE_IMPORT、固定IMPORT阶段和进程中断恢复，使用`ImportWorkerPipelineFixture`。业务目标表必须有正式RLS策略和唯一键；SQL只准备/读回/清理。只停止该夹具保存的Worker子进程，等待真实租约回收与checkpoint续跑，并核对旧尝试、页面完整推送和业务行不重不漏；不能由SQL推进Pipeline或仅受理成功替代。环境及清理边界见runtime-progress夹具说明。

# DISPATCH阶段、未知结果与审批恢复真实联调（2026-10-26）

## 范围与当前状态

继续WDI主矩阵P01／P02。前端`fix/wdi-current` HEAD `662d254e2f8b97f93021de548815470d2291c997`，后端同分支HEAD `f3d5e400d3b5bd737124b57cf0a38e685432aab2`，包含各自现有未提交改动。前轮PROCESS与Atomic已真实通过，本轮DISPATCH第四轮真实Chromium 1/1、0重试通过，隔离runner退出0。

正式入口`E2E_SKIP_GLOBAL_SETUP=1 npm run test:e2e:dispatch-worker-progress:real`。独占平台库、Kafka／对象namespace、认证账号、18181／18182／18183／5181及Worker进程。额外显式`E2E_DISPATCH_OBJECT_UPSTREAM`限定本地HTTP对象存储；不启停共享服务，不修改共享账号或凭据。

## 验收边界

- 通过正式上传API把8 MiB源文件写入真实对象存储、确认到达；创建真实DISPATCH Job及四节点Workflow，经Kafka／Orchestrator／Worker推进。采用真实NAS适配器到本例独占本地目录，不声称外部NAS挂载、SFTP或其他渠道已验收。
- Worker不启用local／test profile，避免NAS被stub替换。独立HTTP代理只对本例对象GET限速，透传原字节和S3签名，不替换对象响应、不记录认证头；SQL只读回与终态清理。
- 观察真实DISPATCH阶段、部分临时文件、最终目标／manifest尚不存在，才停止保存的Worker进程；重启后要求EXTERNAL_OUTCOME_UNKNOWN阻止自动重投，原运行保留FAILED。
- 独立核实目标未发布后，ADMIN从当前`/observability/queries?tab=deadLetters`页面提交未执行证据，由另一TENANT_ADMIN审批一次恢复。核对授权消费、唯一持久分发记录、实际字节／SHA、sidecar及回执；新目标成功不能覆盖原失败记录。
- Job六阶段与SSE状态、未经过的RETRY／COMPENSATE、原／新父Workflow及在线无周期GET分别核对。终态后清理本例对象、NAS目录、审批／运行／Pipeline／身份，再独立检查租户表残留。

## 本轮发现与实现

`DeadLettersTab`原来对非ADMIN仍显示重放及批量选择，而后端为ADMIN_ONLY；危险确认与表单提交未固定租户／操作者，期间切换租户、权限或维护冻结可能继续提交旧目标。组件回归先复现5失败／1通过，修复使用现有权限和写冻结守卫，并在确认、提交、每个批量请求前复核范围；旧表单随租户／写权限变化关闭。API载荷保持正式核实证据契约。第一批组件/API回归8项通过，追加批量确认跨租户回归及完整静态检查仍按实际终态记录。

新增专用Worker夹具、真实对象限速代理及两份只读／清理SQL；复用既有上传、随机身份、审批页和精确清理方法。当前NAS目录为本例临时目录，不重造Workflow模型或为通过测试放宽未知外部结果围栏。真实结果、失败诊断、截图与最终清理将在本报告追加。

## 第一轮诊断

日志`/private/tmp/wdi-p01-dispatch-progress-real-1.log`，原始结果`/private/tmp/wdi-dispatch-first-failure-results.json`。自定义`acceptance-real`不是后端识别的非生产profile，按fail-secure生产规则拒绝本地数据库弱凭据，Worker未进入执行，Job尚未触发。保留该安全检查与共享凭据，改用`BatchProfileSupport.NON_PROD_PROFILES`已列明的`e2e`；NAS仅排除local／test，所以e2e仍选择正式适配器。74项精确清理及租户表残留全0，隔离库诊断后删除；不把首轮当传输或恢复证据。

本轮新增批量确认跨租户组件回归后，组件与API共9项通过；typecheck、407文件测试事实来源、定向ESLint、用例发现1项、前端构建及文档／Changelog／Skill结构检查均通过。真实结果继续由下一轮验证。

## 第三轮诊断

日志`/private/tmp/wdi-p01-dispatch-progress-real-3.log`，原始结果`/private/tmp/wdi-dispatch-third-failure-results.json`。实际完成未知结果核实、ADMIN申请／另一TENANT_ADMIN审批、一次性授权消费、新Job成功及唯一分发记录ACKED／SUCCESS／attempt2；源Job仍FAILED。两次真实S3 GET分别中断／完整，第二次完整8388608字节。独立读取NAS文件与sidecar，SHA均为`40f705a9c952402cb4a6cbd6653b4c6674e59ddc57051972a84e19889163a9cb`，逐字节匹配固定源内容；读回证据`/private/tmp/wdi-dispatch-third-file-readback.json`。本轮套件仍失败，不计最终通过。

失败断言把已执行的DLQ审批误写为APPROVED；正式`ApprovalCommandStatus`及审批服务要求成功执行后EXECUTED，已改为更完整终态。收尾独立残留扫描又发现源文件1条／审计3条：分发把元数据`channelCode`改为目标NAS渠道，原上传清理按可变渠道匹配已不适用。改为在上传会话返回时保存数字文件ID、bucket与path，按精确身份删除文件／审计／对象，并用对象stat缺失独立验证；不改变产品渠道元数据语义。第三轮实际对象、NAS目录、文件／审计已按保存身份精确移除并回读0，再删除本轮独立库。第四轮需重新验证完整套件与新增清理断言。

## 第二轮诊断

日志`/private/tmp/wdi-p01-dispatch-progress-real-2.log`，原始结果`/private/tmp/wdi-dispatch-second-failure-results.json`。已实际启动正式NAS适配器，S3 GET=200，进程中断时目标临时文件1328733字节、最终文件与sidecar不存在；重启后分发记录为FAILED／EXTERNAL_OUTCOME_UNKNOWN、attempt仍1，仅一次源对象GET，无自动重投。租户管理员API重放403、当前综合查询页无重放／批量选择入口均通过。

场景停在原生checkbox输入的Playwright动作性检查（Element Plus隐藏原生input），尚未申请审批；改为点击可见label并独立断言checked，不改变核实条件或审批路径。74项精确清理全0，隔离库诊断后删除。失败页面截图现于catch时保存，避免finally的about:blank抹去诊断画面。第三轮继续使用新隔离资源，前两轮均不计通过。

## 最终真实结果

基于最终前端构建，第四轮1/1、0重试通过。实际8 MiB对象传输中断后保留未知结果、未自动重投；ADMIN从综合查询死信页提交核实未发布证据，另一TENANT_ADMIN审批后仅一次消费授权，新Job成功，原Job与原Workflow保持FAILED。唯一分发记录ACKED／SUCCESS／attempt2，审批EXECUTED；两次源对象GET为中断／完整，目标文件字节、SHA、sidecar及回执一致。目标Job六阶段中PREPARE／DISPATCH／ACK／COMPLETE成功，RETRY／COMPENSATE未执行，原失败图保留原因码。在线4.5秒无周期进度GET，租户管理员重放403且无写入口。

[脱敏证据](./assets/dispatch-worker-progress-2026-10-26/real-evidence.json)及[在途](./assets/dispatch-worker-progress-2026-10-26/dispatch-in-flight.png)、[未知结果](./assets/dispatch-worker-progress-2026-10-26/dispatch-unknown.png)、[恢复成功](./assets/dispatch-worker-progress-2026-10-26/dispatch-recovered.png)三图已保存并人工检查无遮挡、实际阶段与原因码可见。原始结果`/private/tmp/wdi-dispatch-fourth-passed-results.json`，日志`/private/tmp/wdi-p01-dispatch-progress-real-4.log`，服务目录`/private/tmp/wdi-p01-dispatch-progress-20261026145943`。

77项清理计数全0，包含保存数字身份的文件／审计、对象stat缺失、NAS目录、审批、Job／Pipeline与租户表残留。四轮本任务DISPATCH隔离库剩余数0，四临时端口全部释放。9项权限／API定向回归、可读性、类型、ESLint、构建、407文件事实源与文档守卫已通过；统一文档站体积及最终整体前端门禁仍在后续收口，不把本地NAS适配器验证外推外部挂载、SFTP或生产发布。

## 最终构建后的读取隔离与复验

收口核对发现死信查询仍有读取竞态：切换租户后旧行未立即清空，旧请求成功可覆盖新租户行，旧请求失败可清空新行。新增三项组件回归全部先红；修复按捕获租户和递增请求序号处理列表／错误／加载状态，切租户同步清空旧列表及详情，组件销毁后撤销旧请求结果。原提交权限、确认和批量范围守卫保持。组件与API共12项通过；完整`verify:local`退出0，198文件／1134项测试通过，覆盖率63.59%／56.93%／53.64%／65.34%，构建、预算及生产依赖0漏洞通过。

第五轮在账号准备期间因本机磁盘不足而解包失败，未进入业务执行，不计通过；77项清理全0，原始失败结果保存在`/private/tmp/wdi-dispatch-fifth-failure-results.json`，该轮独占库无连接后已删除。只移除已核实无人使用的本任务G02临时前端依赖副本、G04隔离Maven依赖副本及G10旧临时JAR，保留工作树、源码、日志和当前正式运行包；未清理其他任务资料。

第六轮使用最终前端构建及当前WDI后端真实通过1/1、0重试，runner退出0，原始结果`/private/tmp/wdi-dispatch-sixth-passed-results.json`、日志`/private/tmp/wdi-p01-dispatch-progress-real-6.log`，服务目录`/private/tmp/wdi-p01-dispatch-progress-20261026160440`。再次核对8388608字节、SHA、sidecar、成功回执、未知结果阻断、不同身份审批及唯一授权消费；原失败与目标成功分离，在线无周期GET。最新脱敏JSON和三图已替换为本轮证据，源码摘要对应最终读取修复，三图已人工检查。77项清理全0；独立查询本任务六轮隔离库剩余0，18181／18182／18183／5181均释放。

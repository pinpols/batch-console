# Workflow 重放、分支与 EXPORT 恢复真实联调（2026-10-26）

## 范围与结论

本轮按 WDI 主实施矩阵的 P00／P02 验证未知结果拒绝与已知 HTTP GET 失败后的精确节点重放。前后端为 `fix/wdi-current` 未提交工作区，HEAD 分别为 `662d254e2f8b97f93021de548815470d2291c997`、`f3d5e400d3b5bd737124b57cf0a38e685432aab2`。使用独占数据库、Kafka 命名空间、临时认证身份和真实 Atomic Worker，独立服务端口为 18181／18182／18183／5181，不重启共享服务。

失败节点重放最终真实认证 Chromium **2/2通过，0重试、0跳过**；开始／结束时间经推送到达页面，并与 PostgreSQL 独立回读一致。脱敏状态、构建摘要及清理计数见[证据JSON](assets/workflow-failed-node-replay-2026-10-26/real-evidence.json)。复跑入口为 `E2E_SKIP_GLOBAL_SETUP=1 npm run test:e2e:workflow-node-replay:real`，环境与隔离边界见[夹具说明](../../e2e/fixtures/runtime-progress/README.md)。日志为 `/private/tmp/wdi-p02-node-replay-real-11.log`。

## 实际业务证据

源冻结图为 `START → FORK → LEFT／RIGHT → JOIN(ALL) → FAIL_JOB → END`；前五个控制节点经实际调度到达成功，真实 Worker 作业失败，Job与Workflow均失败。未到达END没有物化node_run，但完整冻结图仍显示七个节点，END投影为 `NOT_EXECUTED`。源页面显示失败节点 `FAIL_JOB`，整图适应画布，未把根运行内部END游标当执行位置。

| 场景 | 真实执行与边界 | 页面／持久化结果 |
|---|---|---|
| SQL外部结果未知 | Worker执行 `SELECT 1 / 0`，静态非幂等执行器按现有规则将启动后失败保守标为 `EXTERNAL_OUTCOME_UNKNOWN` | ADMIN页面预览409；审批、重放操作和新运行均未创建。没有放宽未知结果围栏。 |
| 已知HTTP GET失败 | Worker请求本例本地HTTP服务，业务输入缺失时实际503；补齐本例受限业务表输入后实际200 | ADMIN从精确失败节点提交；待审批时无新运行；另一TENANT_ADMIN在审批页批准，审批EXECUTED、补偿命令SUCCESS、操作SUCCEEDED且总数1／成功1／在途0。源运行保持FAILED，新目标运行及全部节点SUCCESS，两个Job分别FAILED／SUCCESS。 |

重放请求保留源Workflow Run、Node Run与Job Instance的精确标识，申请人与批准人不同。TENANT_ADMIN在源详情页看不到节点和整轮重放申请入口，直接预览403；审批能力仍遵循原有后端角色边界。

成功HTTP响应在实际网络服务内暂缓返回，直到浏览器收到目标RUNNING与关联Job RUNNING快照后才释放；设置有界等待，不通过SQL写终态或固定短延时制造观察窗口。随后浏览器收到SUCCESS、真实开始／结束时间，DOM结束时间与数据库毫秒时间相等。在线空闲4.5秒未发生周期execution-progress GET。

## 本轮产品修复及验证

- 后端节点／整轮重放预览和提交均为 ADMIN_ONLY；原前端按 ADMIN／TENANT_ADMIN 显示入口，真实联调观察到租户管理员点击后403。现按后端权限修正按钮及动作，并在确认后复核租户、运行、权限和精确源节点。审批角色仍遵循既有接口，未改变授权模型。
- 宽分支图未默认适应画布，初始视口截断右侧节点；现启用既有自动适配能力，保留缩放。
- 根运行内部游标可在失败时记录END，不能作为真实执行位置。主档改用完整节点快照显示所有执行／等待／失败节点，源失败展示FAIL_JOB，终态成功不伪造当前节点。新增两项派生状态测试先失败后通过，连同原资格／图状态用例24项通过；前端构建、i18n与定向ESLint通过。

SQL执行器的静态非幂等能力使启动后的失败被保守标为外部结果未知，这是当前安全边界，不作放宽。成功重放场景另用受控本地HTTP GET：真实网络先503，补齐业务输入后200；未知与已知两条路径分别验收。

原推送只有根状态，结束时间仍可能显示为空；现Mapper、投影、DTO、OpenAPI和前端生成类型携带持久化startedAt／finishedAt，同状态补齐时间也触发推送，未知时间保持为空。时间映射／图投影／推送变化判断后端15项通过，其中真实PostgreSQL Mapper 1项。时间字段先由真实Mapper测试检出缺失，再补实现；前后端构建、类型、i18n、定向ESLint与OpenAPI漂移检查通过。

## 环境与清理

两个场景各49项精确清理计数全部为0，包含身份、定义、运行、Job／Task、审批、补偿、业务表、事件投递、告警和对象登记；另枚举batch／archive／biz下所有带tenant_id的基础表，确认本例租户无残留。成功后隔离数据库删除，保存的进程句柄逐一停止，临时端口释放。开发失败轮次保留状态排查后已清理对应隔离库，不以删失败记录作为通过证据。

开发过程修正了fixture的biz schema、JOIN ALL配置、退役清理表和未到达节点的断言；SQL未知结果与已知HTTP失败分开验收，没有更改生产HTTP安全白名单。JDBC修改后的Mapper测试沿实际查询路径重新设置租户以刷新同会话缓存，不把测试缓存误认作生产时间未落库。

## 实际业务分支补充验收

入口 `test:e2e:workflow-dag-branches:real` 在同版WDI产物上真实认证Chromium **2/2通过，0重试、0跳过**。状态、完整推送、构建摘要和四张截图见[分支证据](assets/workflow-dag-branches-2026-10-26/real-evidence.json)，日志为 `/private/tmp/wdi-p00-dag-real-2.log`。

- 双业务Job：两个独立定义由实际Worker发起HTTP请求，两个Task同时RUNNING；页面同时显示LEFT_JOB／RIGHT_JOB，节点对应Job ID逐一与数据库一致。先完成左侧后，根运行仍RUNNING，JOIN无运行记录，页面只显示右侧在途；右侧完成后ALL汇合仅执行一次，六节点全部SUCCESS。
- 条件／失败分支：真实启动payload带 `route=process`；未选中分支SKIPPED且原因 `CONDITION_NOT_MATCHED`。HTTP作业实际503后沿FAILURE边执行处理Job并实际200；成功专用下游SKIPPED且原因 `UPSTREAM_FAILED`。处理Job和END均SUCCESS，失败Job与根Workflow仍FAILED，不把处理成功等同于根成功。
- 两个场景均由SSE到达终态及真实结束时间，与数据库一致；在线空闲4.5秒无周期GET。每例49项精确清理全0，并核对全部租户表无残留。

首轮两例等待首个HTTP请求超过默认8秒，Worker日志显示新Kafka订阅在注册约30秒后才分配分区；失败时Task仍READY。原始状态与输出保存于 `/private/tmp/wdi-dag-first-failure-results.json`、`/private/tmp/wdi-p00-dag-real-1.log`，两个场景各49项清理为0。改为有界等待首次消费，并在失败收尾释放后续请求后通过；未修改业务状态语义或安全规则。

## 整轮 Workflow 重放与 EXPORT 进程恢复

最终入口 `test:e2e:whole-workflow-replay:real` 真实认证Chromium **1/1通过，0重试、0跳过**，日志 `/private/tmp/wdi-p02-whole-export-real-10.log`；第六轮核心链路及第九轮权限／菜单增强版均1/1通过；第十轮在依赖补丁后的新构建完整复验，仍保留全部业务与权限断言。脱敏状态、实际运行包／源码摘要及53项零残留见[整轮重放证据](assets/workflow-whole-replay-export-2026-10-26/real-evidence.json)。两张最终截图已人工核对，无引导遮罩：[GENERATE执行中](assets/workflow-whole-replay-export-2026-10-26/job-export-running.png)、[重放后冻结DAG成功](assets/workflow-whole-replay-export-2026-10-26/workflow-replayed-success.png)。

- 实际源图为START→GATEWAY→EXPORT_JOB→END；BUNDLE_EXPORT由真实EXPORT Worker读取强制RLS的业务表。能力声明来自实际`jdbc_mapped_export`注册，没有SQL注入registry。无在线Worker时预览返回阻断，未创建审批或操作；另一TENANT_ADMIN直接申请预览403。
- 源运行成功后，经正式编辑锁及`/full`更新当前定义至v2，增加NEW_NODE；从源运行预览仍为原v1的四节点和原依赖。ADMIN提交待审批时没有目标运行；不同TENANT_ADMIN在审批页批准后才创建新目标，审批EXECUTED，重放操作SUCCEEDED，总数1／成功1／在途0，策略CREATE_NEW_VERSION与USE_ORIGINAL_CONFIG。
- 目标GENERATE到25条checkpoint后，仅SIGKILL本例保存的Worker子进程，再启动同一Worker身份。真实租约回收后继续处理至1200条；旧GENERATE尝试为FAILED／PIPELINE_ATTEMPT_INTERRUPTED，后续尝试SUCCESS，无遗留RUNNING步骤。两个Workflow、两个Job和两个Pipeline最终均SUCCESS；新目标仍按原v1四节点，未执行当前v2新增节点。
- 原／新文件使用不同对象键，每份1200条有序唯一业务键、两列独立预期和正确金额；跨租户哨兵行不在输出，业务表仍1200个不同键。实际读取对象字节核对SHA，原产物未改变；独立产物不由相同文件元数据代替。
- 浏览器实际接收9份Workflow和31份Job完整快照，执行中显示GENERATE、25条已处理记录及关联Pipeline，终态冻结图4/4成功。在线空闲4.5秒没有周期execution-progress GET；处理行数、已结束分区和已创建任务保持独立口径。
- 最终53项清理计数全部为0，所有租户业务表无残留；精确对象、独占关系和本例JVM临时目录均已移除。成功库由runner删除，另独立查询对应数据库前缀为0，18181／18182／18183／5181全部释放；未启停共享服务。

### 本批发现与产品修复

共用RowActions的“更多”点击会冒泡到表格行而误打开审批详情；先用真实Element Plus组件回归复现，再停止按钮冒泡。最终真实审批页打开“更多”只显示菜单、不打开行抽屉，再执行实际批准。作业实例列表原未按角色隐藏批量重试／取消，详情重跑沿用了配置写权限，移动重跑／终止也缺入口限制；依据Controller的ADMIN_ONLY修正入口与处理函数，确认后复核租户、目标和写权限。最终TENANT_ADMIN查询真实作业可见，但详情重跑、列表选择／批量入口隐藏，重跑／取消API均403；ADMIN重跑按钮可见，本例不实际执行单作业重跑。

相关行操作、移动权限及批量选择定向回归24项通过；行操作回归先失败后通过。前端类型、i18n、生产构建、定向ESLint、401文件测试事实来源、架构、注释及可读性守卫自测通过。维护性检查曾因本次上传功能使FileList达到1244行失败，已抽出原统计卡及样式为专用组件，原筛选事件和窄屏两列布局保留，未扩大预算；最终维护性检查通过。所有这些是对应范围证据，不代替全仓发布验收。

### 开发失败与隔离经验

首轮模板使用错误`SHA_256`字面量，改为数据库契约的`SHA-256`；21项清理为0。第二轮延迟视图在投影中计算易变表达式，导致分页排序前读取全表，观察超时后任务自身超时；清理因断开客户端仍有源查询持锁而失败，不能记全0。保留原始输出后确认源连接退出，再删除精确隔离库。修正延迟筛选并建立本例索引／统计，回滚事务临时表的实际计划证实LIMIT仅读25行，约1063ms，见`/private/tmp/wdi-export-fixture-plan-proof.log`；收尾先等待本例源查询退出。

第三轮源EXPORT成功但缺`csvColumns`而表头不符，保留独立两列预期、补正式模板列配置；52项清理为0。第四轮错误使用旧定义PUT路径405，改为正式锁和`/full`，53项清理为0。第五轮即时`isVisible()`在审批行加载前误走菜单，暴露上述真实冒泡问题，修复等待与产品事件传播，53项清理为0。第七轮新增权限检查用未来业务日筛选实际开始时间而空表，改为唯一Job编码加`range=all`；第八轮断言同时匹配两个常驻抽屉，改为断言无可见抽屉。七／八轮各53项清理为0，均保存失败结果、不计通过。全部失败隔离库在诊断后精确删除。

不同隔离数据库会重复数字Pipeline ID，宿主机默认导出临时文件名也可能相同；夹具为每例Worker指定独立`java.io.tmpdir`，跨本例重启保留，终态只删除本例目录。共享Worker状态SQL新增`job_definition_ids`时已补齐IMPORT调用，IMPORT真实恢复回归1/1、0重试、57项清理全0，见[IMPORT报告](2026-10-26-import-worker-pipeline-progress.md)。可复用方法已补现有测试Skill及夹具说明，不复制新的恢复模型。

## 完整前端本地门禁

`npm run verify:local`最终成功退出0，日志`/private/tmp/wdi-frontend-full-local-20261026-final.log`，见[门禁证据](assets/workflow-whole-replay-export-2026-10-26/full-local-gate-evidence.json)。197个测试文件／1124项单测全部通过，核心范围覆盖率语句63.39%、分支56.86%、函数53.23%、行65.2%；版本、全仓ESLint／类型／i18n／OpenAPI漂移、治理及反例、生产构建、预算和生产依赖审计均通过。

首次完整运行有10项批次日重放父组件测试失败：新增结果版本子面板使用维护状态store，而原测试只准备了auth／tenant；补齐其原有store隔离方式，保留全部交互和迟到响应断言，定向10项与Markdown3项通过。首次生产审计另报告follow-redirects 1.16.0与markdown-it 15.0.2的公告；正式补丁分别为1.16.2与15.0.3，伴随markdown-it的argparse更新至3.0.4。只更新这些锁定包，禁用安装脚本，未引入直接follow-redirects依赖或放宽审计标准；正式生成器同步SBOM／许可证，最终生产审计为0漏洞。公告边界见[follow-redirects](https://github.com/advisories/GHSA-q3jh-wrc6-jgq8)、[自定义头字段](https://github.com/advisories/GHSA-8r9p-f939-6h3c)、[Markdown链接定义](https://github.com/advisories/GHSA-gfr2-rv44-r23c)和[HTML解析](https://github.com/advisories/GHSA-vfgh-jcmw-g37q)。本地门禁不代替后端业务、文档站或生产验收；新依赖构建的第十轮整轮恢复复验1/1通过、0重试，报告开头的构建摘要与截图已固定为该轮。

## 统一文档站构建边界

`npm run docs:build`以当前配对WDI后端资料完成VitePress客户端／服务端编译及页面渲染，但末尾体积门禁退出1，不能记为文档站构建通过。日志`/private/tmp/wdi-frontend-docs-build-20261026-final.log`。超预算来源为后端`audit/nested-callsite-inventory-2026-10-21.md`（raw1335177／gzip402458 bytes）、后端`plans/workflow-daily-integration-execution-log-2026-10-14.md`（raw2239324／gzip660203）及统一搜索索引（raw4444931／gzip1230913）；普通页阈值raw850KB／gzip220KB，索引阈值raw4.5MB／gzip1.21MB。没有扩大预算或删除后端原始证据，仍需按前后端发布职责解决大文档与索引发布方式；该失败不抹去前述本地应用门禁和真实业务通过结果，也不由它们代替关闭。

## 尚未覆盖

P01剩余真实文件Worker代表路径为PROCESS与DISPATCH执行／恢复及其最终业务副作用；本批EXPORT通过不外推其他Worker。控制与双业务Job分支、失败节点审批重放、整轮原版本重放已分别留证；ALL／CONDITION／FAILURE组合不推断全部Join模式。多定义／双日历／FIXED_RATE日进度见[Quartz报告](2026-10-26-quartz-daily-progress.md)。当前范围与后续整体门禁以[主实施矩阵](../engineering/backend-capability-alignment-plan-2026-10-25.md)为准，不代表生产发布或真实外部渠道验收。

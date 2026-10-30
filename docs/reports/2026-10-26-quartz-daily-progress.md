# Quartz 计划与租户当日进度真实联调（2026-10-26）

## 范围与基线

验证 WDI `fix/wdi-current` 的 Quartz 计划生成、实际 Workflow 触发、租户当日进度统计和现有运维总览的推送展示。前端 HEAD 为 `662d254e2f8b97f93021de548815470d2291c997`，后端 HEAD 为 `f3d5e400d3b5bd737124b57cf0a38e685432aab2`，均包含未提交工作区。本轮未修改后端业务代码。

以隔离数据库和 Kafka namespace 启动当前 WDI Orchestrator、启用 Quartz 的 Trigger、认证 Console 及 Vite：`18182`、`18183`、`18181`、`5181`。共享服务未重启。测试在独占租户创建一条单次 CRON 的 START→END Workflow，目标业务日使用 `Asia/Shanghai` 日历。

## 真实路径与结果

- 真实认证 Chromium 1/1通过、0重试。Trigger 预先物化1条 `PLANNED` occurrence，计划版本与覆盖版本一致；Quartz 到达计划时间后触发Workflow，运行终态为 `SUCCESS`。
- 日统计 API 的覆盖水位为 `scheduledDefinitions=1`、`uncoveredDefinitions=0`。occurrence ledger 在运行后仍为 `REQUESTED`；统计查询将它与成功 WorkflowRun 关联后展示为 `RUN_SUCCESS`。这两个状态属于不同投影，不应混称。
- 推送快照包含计划 `RUN_SUCCESS`。OpsSummary 既有日统计图可见且在线；计划行和 Workflow 行的分母/结束/成功均为1，完成率为100%。捕获推送后空闲4.5秒未发生周期性日统计 GET。
- 初次覆盖查询发生在批次日 cutoff 记录生成前时，隔离运行曾观察到 `uncoveredDefinitions=1`；接口将该日标记为未完整。最终通过的运行在读取初始快照时已形成 cutoff，初始与终态覆盖均为 `1/0`。本报告不声称在这次最终通过运行中观察到了 `1→0` 的完整转变。
- E2E 清理附件中的定义、图节点/边/版本、Workflow运行/节点/请求、定时计划、覆盖水位、批次日、租户、凭据和审计残留均为0。成功运行的隔离数据库已删除；`18181`、`18182`、`18183`、`5181`均无残留监听。

脱敏验收数据见[Quartz当日进度证据](assets/quartz-daily-progress-2026-10-26/real-evidence.json)。

## 多定义／双日历与FIXED_RATE补充

新增`test:e2e:multi-calendar-progress:real`最终真实认证Chromium1/1通过、0重试、0跳过。两条单次CRON和一条86400秒FIXED_RATE，分布在两个Asia/Shanghai日历上；首次固定间隔触发已完成时，计划行3条／成功1条／33%，请求与根运行分别只有1条。两条CRON实际触发完成后，计划RUN_SUCCESS、请求LAUNCHED、根运行SUCCESS分别各3条；Job与Task均为0。三个定义版本分别匹配各自日历的覆盖水位，原始occurrence为REQUESTED，与根状态统计投影区分。

切到次日后只有1条FIXED_RATE计划PLANNED，未来批次日尚未创建，覆盖为`scheduledDefinitions=3/uncoveredDefinitions=3`；页面显示覆盖警告和“未确定”，没有沿用当日三个根运行或计算虚假100%。切回当日恢复3/3、覆盖3/0，在线空闲4.5秒无周期GET。38项精确清理全0，另枚举全部租户业务表无残留，隔离库及临时端口已释放。

首轮业务1/1通过，但截图复核发现首次引导遮罩覆盖后两张截图。用例改为通过真实页面关闭引导，并增加无遮挡断言；最终复跑1/1通过，三张截图重新查看。最终截图与脱敏输出见[多日历证据目录](assets/multi-calendar-daily-progress-2026-10-26/real-evidence.json)，日志为`/private/tmp/wdi-p03-multi-calendar-real-2.log`。本轮未修改后端业务代码或API；定向ESLint、398文件事实来源、文档／变更记录检查及测试Skill元数据校验通过。

## 边界

单CRON与混合日程真实结果分别留证；结合[Atomic Worker作业进度报告](2026-10-25-job-execution-progress.md)中的真实Job/Task链路，现有图表位置可展示五层业务统计，无需另建重复总览。本混合场景是两个相同时区／cutoff的日历，不证明DST、节假日或全部日历策略。Worker文件Pipeline及恢复见对应报告；本地联验不代表生产发布验收。

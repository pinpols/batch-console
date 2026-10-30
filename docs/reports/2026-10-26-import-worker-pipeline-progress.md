# IMPORT Worker 文件阶段与中断恢复真实联调（2026-10-26）

## 范围与基线

本轮验证上传对象经真实 BUNDLE_IMPORT 作业、固定 IMPORT Pipeline 和 Worker 进入业务表，LOAD 中途终止本例 Worker 后，租约回收、checkpoint 续跑及现有 Job／Pipeline／Workflow 页面的进度推送是否一致。两仓均为 WDI `fix/wdi-current` 未提交工作区，前端 HEAD `662d254e2f8b97f93021de548815470d2291c997`，后端 HEAD `f3d5e400d3b5bd737124b57cf0a38e685432aab2`。

使用独占数据库、Kafka／对象命名空间和随机租户，独立启动认证 Console 18181、Orchestrator 18182、Trigger 18183 与固定 Vite 预览 5181。Worker 由夹具保存的子进程句柄管理，仅对该进程执行中断与重启。共享服务保持原状。复跑入口为 `E2E_SKIP_GLOBAL_SETUP=1 npm run test:e2e:import-worker-progress:real`，其余参数和隔离要求见 [runtime-progress 夹具说明](../../e2e/fixtures/runtime-progress/README.md)。

## 实际发现与修复

2026-10-26共享SQL回归补录：多Job验收给`worker-progress-state.sql`增加定义ID集合后，IMPORT旧调用方漏传`job_definition_ids`，本轮补齐其保存的定义ID。重新运行真实上传、六阶段推送及Worker中断恢复，Chromium1/1、0重试、0跳过；最终600条唯一业务行、一个Pipeline、原步骤中断关闭和57项清理全0保持成立。脱敏回归证据见[独立摘要](assets/import-worker-progress-2026-10-26/shared-sql-regression-evidence.json)，日志为`/private/tmp/wdi-import-shared-state-regression-real.log`。这次修复限于测试夹具，不改产品状态逻辑。

1. 首轮夹具业务表缺少正式 RLS 策略，被 Worker 启动检查正确拒绝；补齐 RLS 与唯一业务键后继续。另一轮触发请求错误地使用 `params`，按真实 DTO 改为 `payload` 字符串。这两项属于夹具修正。
2. 实际 Worker 续跑完成后，旧 LOAD 尝试仍为 RUNNING，新尝试已成功。后端在 Job 终态事务内将残留 RUNNING／RETRYING 尝试关闭为 FAILED，保留 `PIPELINE_ATTEMPT_INTERRUPTED` 原因；晚到的 Worker 完成写入不能覆盖已终结尝试。既有成功和原始失败保留，且活跃父 Job 不提前关闭并行步骤。
3. 清理审计发现对象对账仅在默认租户查重，导致其他租户已登记上传对象被重复补录。对账现排除平台保留 `uploads/` 目录，托管上传仍由会话及到达确认管理。真实数据库／对象存储回归同时验证原租户未确认会话保持不变、默认租户没有重复记录，以及普通 `incoming/` 孤儿文件仍能补登记。浏览器验收增加按 bucket＋对象路径跨租户统计文件记录的独立断言。

## 当前验证记录

- Pipeline 中断尝试修复：reconciler 单测 10 项、共享完整迁移的 PostgreSQL 集成 1 项、Worker Mapper PostgreSQL 集成 14 项通过。
- 对象对账修复：目标用例先在旧实现失败；修复后会话清理／对账单测 8 项、共享 PostgreSQL／S3 集成 10 项通过，无跳过。
- 对账修复前一轮真实 Chromium 1/1、0 重试，600 条数据与 600 个不同业务键、六阶段最终成功、旧 LOAD 中断原因及在线无周期 GET 均通过。该轮未覆盖跨租户重复记录，不能作为对账修复验收或完整零残留证明。
- 对账修复后真实 Chromium 1/1、0 重试通过：输入 7108 字节／600 行，在 50 行已提交时中断 Worker；最终 600 行、600 个不同业务键，原文件仅关联一个 Pipeline，同一对象跨租户仅一条文件记录。LOAD 第一次尝试为 FAILED／`PIPELINE_ATTEMPT_INTERRUPTED`，第二次 SUCCESS，checkpoint 为 600／completed；当前六阶段及四个 Workflow 节点最终均成功。
- Job 与 Pipeline 页面分别收到 2／24 份完整快照；运行中页面实际渲染 LOAD 已处理数至少 25，最终页面可见 LOAD 600，在线空闲 4.5 秒没有周期性进度 GET。当前图来自运行冻结版本，GATEWAY 与 JOB 关联数据库读回一致。
- 本轮 57 项清理计数全部为 0；三份失败隔离库的唯一残留已证实为本例上传对象的默认租户误登记，无活跃实例或连接后精确移除。本次成功库也已移除，四个临时端口均释放。

脱敏结果、运行包 SHA-256 和各层测试数量见 [验收证据](assets/import-worker-progress-2026-10-26/real-evidence.json)。页面截图：[LOAD 运行中](assets/import-worker-progress-2026-10-26/import-job-running.png)、[恢复成功](assets/import-worker-progress-2026-10-26/import-job-recovered.png)。

## 验收边界

本路径是真实对象、真实 Worker 和业务写入，与 SQL 推进 Pipeline 的传输测试分开。SQL 只准备目标表、RLS、IMPORT 模板并独立回读／清理，不直接写作业或步骤终态。业务目标上的短延迟触发器仅用于观察 LOAD 在途状态，不替代 Worker 执行。

本场景覆盖 `START → GATEWAY → JOB → END` 及 ALWAYS／SUCCESS 边、单文件单分区 IMPORT、Worker 进程中断自动续跑；不代表 Workflow 显式失败节点重跑、其他文件 Worker、更多 DAG 分支／汇合、调度组合或生产发布验收。后续仍按 [主实施矩阵](../engineering/backend-capability-alignment-plan-2026-10-25.md) 推进。

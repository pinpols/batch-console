# 阶段报告索引

本目录保存一次性审查、实施记录和验收快照。数字和结论只适用于报告日期对应的提交、数据与环境；当前事实以源代码、自动化门禁和现行工程/运行手册为准。

## 2026-10

配置复制、作业包及向导的校验、权限、选项、提交和旧响应处置见[前后端Bug审查与验证汇总](../../../file-batch-system/docs/review/frontend-backend-bug-review-2026-10-27.md#frontend-review-record)，保留首红、维护只读反例、配对后端数据完整性与剩余边界；同日续记静态制品错误状态及真实Nginx HTTP回归。

前后端Skill界面元数据及按需参考整理见[2026-10-26复核记录](2026-10-26-skill-metadata-and-references.md)，覆盖现行入口、原方法保留与调用策略边界。

本轮前端代码 Bug、异步竞争和错误操作目标的修复与回归见[2026-10-26 Bug 治理记录](2026-10-26-frontend-bug-remediation.md)，与后端审查和运行验证互链；规约门禁不计入 Bug 成果。

统一站点超长证据分卷、预算与真实导航见[2026-10-26 发布复验](2026-10-26-document-publication-size.md)，保留原始失败、完整性证据和生产未验边界。

真实 IMPORT 对象、阶段推送及进程中断恢复见 [2026-10-26 联调报告](./2026-10-26-import-worker-pipeline-progress.md)，包含业务行、跨租户对象唯一性与清理证据。

PROCESS双库WAP、阶段推送和COMMIT中断恢复见[2026-10-26记录](./2026-10-26-process-worker-pipeline-progress.md)，真实600条业务记录、旧新尝试、页面计数及51项零残留均通过；代表插件范围不外推其他渠道。

DISPATCH真实字节传输、未知结果阻断与核实后的审批恢复见[2026-10-26记录](./2026-10-26-dispatch-worker-pipeline-progress.md)，真实8 MiB传输中断、核实审批恢复及77项零残留通过；同时补齐死信重放的ADMIN权限与确认后范围守卫。

Workflow 实际双作业并行、条件／失败分支、失败节点及整轮审批重放与真实EXPORT中断恢复见 [2026-10-26 联调报告](./2026-10-26-workflow-failed-node-replay.md)，区分源运行、新目标运行与真实 Worker 执行结果。

| 文档                                                                               | 主题                                                                                                           |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [批次日治理真实联调](./2026-10-25-batch-day-governance.md)                         | 六种治理动作、补扫控制、四角色与丢响应/刷新原键恢复                                                            |
| [Atomic 已保存配置真实联调](./2026-10-26-atomic-saved-config.md)                   | Atomic 参数预设的页面保存/复用、持久化读回和角色权限                                                           |
| [OIDC 身份绑定真实联调](./2026-10-26-oidc-identity-bindings.md)                    | 单租户身份绑定/解绑、冲突、角色、审计和租户隔离                                                                |
| [取证导出真实联调](./2026-10-26-forensic-export.md)                                | 真实认证导出、ZIP/Manifest/SHA-256核对、权限边界与精确清理                                                     |
| [Worker认领任务诊断真实联调](./2026-10-26-worker-claimed-task-diagnostics.md)      | 认领任务白名单摘要、租户隔离、平台诊断角色及真实Worker页面                                                     |
| [人工文件上传真实联调](./2026-10-26-manual-file-upload.md)                         | MinIO内容上传、文件组/业务日/模板绑定、确认后触发唯一Workflow、审计与角色权限                                 |
| [Workflow历史版本真实联调](./2026-10-26-workflow-definition-versions.md)           | v1–v4持久快照、所选版本比较、租户隔离与迟到响应丢弃                                                            |
| [持久等待真实联调](./2026-10-26-persistent-waits.md)                               | PostgreSQL等待记录、Console安全投影、调度快照页、四角色与租户隔离                                              |
| [调度依赖等待真实联调](./2026-10-26-scheduler-dependency-waits.md)                | 跨日历与作业依赖等待、调度快照页、角色边界及手动 SKIP/RELEASE 调度消费                              |
| [敏感操作权限真实联调](./2026-10-26-sensitive-page-permissions.md)                | 配置同步与Workflow运行控制的ADMIN角色门控、直达路由、写冻结与当前运行状态                                      |
| [结果版本治理真实联调](./2026-10-26-result-version-governance.md)                  | 安全元数据投影、提升/归档、操作审计及角色边界                                                                  |
| [Pipeline完整推送与真实传输](./2026-10-25-pipeline-progress-push.md)               | 当前页全快照推送、最新阶段、终态缓存隔离及SQL夹具真实传输边界                                                  |
| [作业阶段与依赖上下文进度](./2026-10-25-job-execution-progress.md)                 | 真实Worker进度、Job暂停恢复、Workflow控制DAG冻结图与终态、Atomic角色门控、租户日统计；保留Quartz和失败恢复边界 |
| [运行图与业务日进度真实联调](./2026-10-25-runtime-progress-integration.md)         | 冻结图、完整快照推送、业务日五层统计及尚未关闭边界                                                             |
| [Quartz计划与租户当日进度真实联调](./2026-10-26-quartz-daily-progress.md) | 单CRON及三定义双日历CRON／FIXED_RATE、覆盖不足、日期切换、实际运行与日统计推送 |
| [文档归档与 Skill 路由复核](./2026-10-25-document-governance-and-skill-routing.md) | 前端文档分类、历史归档、命名与检查脚本的技能路由                                                               |
| [客户端分页迁移完成记录](./client-side-aggregation-pagination-2026-10-01.md)       | 运行态列表从全量聚合迁移到服务端分页                                                                           |

## 2026-09 与 2026-08

| 文档                                                            | 主题                                   |
| --------------------------------------------------------------- | -------------------------------------- |
| [前端页面打磨记录](./frontend-page-polish-2026-09-27.md)        | 页面/路由/交互整理及其未覆盖的验收边界 |
| [前端验收 2026-09-01](./acceptance/fe-acceptance-2026-09-01.md) | 当日真实环境联测快照                   |
| [前端验收 2026-08-31](./acceptance/fe-acceptance-2026-08-31.md) | 当日全量门禁和 E2E 快照                |
| [前端验收 2026-08-28](./acceptance/fe-acceptance-2026-08-28.md) | 当日部分验收快照，含明确 SKIP 项       |

## 原始治理执行证据

- [代码可读性治理执行记录（2026-10-13 至 2026-10-24）](code-readability-execution-log-2026-10-13-to-2026-10-24.md)：保留原始批次、扫描计数与边界；现行规则见[代码可读性治理](../engineering/code-readability-governance.md)。

2026-05 早期工程、依赖及发布快照已归入[历史报告](../archive/reports/README.md)，不作为当前实施或验收结论。

- [2026-10-26 前端逐文件 Bug 覆盖清单](2026-10-26-frontend-bug-file-coverage.csv)：待审、部分审查、已审与内容摘要；全量盘点不等于语义审查完成。

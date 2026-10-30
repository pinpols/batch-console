# 2026-05 QA Campaign 归档

本目录保存 2026-05 已结束的 C/D 档 QA 计划、联测报告、阶段报告、原始输出及当时准备的后端补丁。报告中的 PASS/SKIP 数字、角色模型、端点和测试结构均为历史快照，不代表当前代码或门禁。

- 当前自动化测试入口：[测试指南](../../testing/README.md)。
- 当前 PR/全量/发布门禁：[CI 运行手册](../../runbook/ci.md)。
- 当前真实环境验收：[上线准入清单](../../runbook/go-live-readiness-checklist.md)。
- `be-patches/` 下的补丁只保留历史原件，**不得直接应用**；实施前必须到配对后端核对当前代码与迁移状态。

- [Phase 1 API CRUD 历史问题](./be-fix-backlog-2026-05-16.md)：当时发现与修复依据；日期来自首次提交，表内状态不是当前待办。

## 历史测试数据交付记录

- [测试计划与当时交付快照](e2e-data-test-plan-2026-05-11.md)
- [测试数据文件核验记录](e2e-data-verification-2026-05-11.md)

当前数据输入说明见 [`../../../e2e-data/README.md`](../../../e2e-data/README.md)；旧写脚本已退役，当前验收入口见测试指南。

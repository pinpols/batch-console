# 历史文档归档索引

本目录及其子目录保存已完成项目、失效方案和日期化历史快照。归档材料只用于追溯决策与当时证据，不作为当前实现、权限、依赖、门禁或发布状态的依据。

| 子目录 | 内容 | 当前权威入口 |
|---|---|---|
| [`qa-2026-05/`](./qa-2026-05/README.md) | C/D 档 QA campaign、联测计划/报告、历史补丁 | [`../testing/README.md`](../testing/README.md)、[`../runbook/ci.md`](../runbook/ci.md) |
| [`reports/`](./reports/README.md) | 早期审查、整改、依赖与 E2E 根因排查快照 | 当前 E2E 分层与验收见 [`../testing/README.md`](../testing/README.md) |
| [`stats/`](./stats/README.md) | 历史 LOC 快照 | 当前实现以代码为准；统计需在当前基线上重新生成 |
| [`redesign-2026-07/`](./redesign-2026-07/README.md) | 已完成重设计计划、旧原型与截图 | [`../../design/README.md`](../../design/README.md) |
| [旧密码安全方案](./security/password-security-history-2026-05-18.md) | 密码治理旧提案与实施前快照 | [`../runbook/security-alert-governance.md`](../runbook/security-alert-governance.md)、后端安全契约 |
| [`verifications/`](./verifications/README.md) | 旧 Windows/PowerShell CD 试验 | [`../runbook/release-promotion.md`](../runbook/release-promotion.md)、[`../runbook/rollback.md`](../runbook/rollback.md) |
| [前端 V3 旧设计](./early-proposals/frontend-design-v3-2026-03-28.md) | 旧 Bearer 认证、独立 Pipeline 与节点设计取舍 | [`../architecture/project-structure.md`](../architecture/project-structure.md)、[`../user-guide/README.md`](../user-guide/README.md) |
| [旧文档中心提案](./early-proposals/内嵌文档中心方案.md) | 已被统一文档站取代的早期方案 | [`../engineering/unified-documentation-site.md`](../engineering/unified-documentation-site.md) |

根目录其他日期化档案按文件名和正文日期识别。不要根据历史文档中的旧路线、角色、数字或未勾选项新建工作；先核对代码和现行权威文档。

已退役的执行源码分别保存在 [`../../e2e-data/archive/`](../../e2e-data/archive/README.md)、[`../../e2e/archive/`](../../e2e/archive/README.md) 与 [`../../scripts/archive/`](../../scripts/archive/README.md)。这些文件不属于当前造数、清理、认证或分支同步入口。

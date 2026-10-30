# 结果版本治理真实联调

## 范围与基线

- 前端与后端均基于 WDI `fix/wdi-current` 工作树，验收基线分别为 `662d254e2f8b97f93021de548815470d2291c997` 与 `f3d5e400d3b5bd737124b57cf0a38e685432aab2`；保留原有并行工作区改动。
- 本记录关闭能力矩阵 G06 的本地真实 API、持久化、审计和角色浏览器验收，不代表17项整体关闭或生产发布验收。
- 使用独立前端生产预览 `127.0.0.1:5181`、真实认证 Console `127.0.0.1:18181` 和本地 PostgreSQL 容器；18080 Console 与共享 Orchestrator 未操作。

## 实现与结果

- 批次日重放页按业务键显示版本、当前生效版本和治理状态；候选版本详情仅显示元数据。Console DTO 与 OpenAPI 不再暴露原始 `payloadJson` 或内部 `payloadRef`，数据库中的原始结果仍供业务读取。
- ADMIN/TENANT_ADMIN 可提升或拒绝 PENDING 候选。后端为提升与拒绝写入 `result_version.promote` / `result_version.reject` 操作审计；前端中英文状态标签覆盖归档、替代、演练和待处理状态。
- 第一次真实运行发现测试关闭抽屉时选择器匹配到页面上其他抽屉，且清理 SQL 的 JSON 字段名与夹具断言不一致。两处验收代码修正后重新完整执行，最终 1/1 通过、0 重试。

## 真实验收证据

- 匿名 `/api/console/auth/me` 返回 401；临时真实账号登录后，Console 列表和详情 API 均不含 `payloadJson`、`payloadRef` 或数据库载荷标记，页面详情也未显示载荷标记。
- 真实提升后版本状态为 v1 `SUPERSEDED`、v2 `EFFECTIVE`，该业务键仅有一个 EFFECTIVE；两个独立候选均变为 `ARCHIVED`。数据库回读确认载荷仍在业务存储中。
- 权限回读：ADMIN 与 TENANT_ADMIN 读取/写入均为 200；AUDITOR 与 TENANT_USER 读取为 200、写入为 403；租户用户跨租户读取为 403。
- 数据库回读到3条成功操作审计，动作包含一次提升和两次拒绝，操作者不是未知身份。清理删除本例4个版本，`resultVersionRowsRemaining=0`；租户、账号、操作审计及其他父夹具清理计数全部为0。脱敏证据只保留动作/结果，不保留临时租户或操作者标识。

截图与机器结果：[真实验收摘要](assets/result-version-governance-2026-10-26/real-evidence.json)、[版本详情](assets/result-version-governance-2026-10-26/result-version-detail.png)、[归档状态](assets/result-version-governance-2026-10-26/result-version-archived.png)。

## 验证命令与边界

- 后端 `./mvnw -pl batch-console-api -am -Dtest=ConsoleResultVersionControllerTest -Dsurefire.failIfNoSpecifiedTests=false test`：6项通过。
- 前端 `npm run typecheck`、`npm run gen:api:check`、定向 ESLint、`npm run check:i18n`（6119项 key 对齐）、`npm run check:test-fixture-sources`（379个测试文件）及 `npm run build` 均通过。
- 真实浏览器命令：`E2E_SKIP_GLOBAL_SETUP=1 npm run test:e2e:result-versions:real`；测试通过后执行 PostgreSQL 精确状态回读和零残留清理。
- 统计图不另建孤立页面：租户业务日统计图表放在现有运维总览 `OpsSummary`，单次作业进度放在作业详情，Workflow 节点状态放在运行详情/DAG，文件 Pipeline 阶段留在原观测页。统计图和 DAG 的推送验收证据分别见[作业进度报告](2026-10-25-job-execution-progress.md)与[运行图报告](2026-10-25-runtime-progress-integration.md)。
- 该验收使用本地 WDI 服务，不能证明生产部署。G07–G12、B01 真实浏览器/持久化验收，以及 P01/P02 的 Worker 故障恢复、文件 Pipeline 与其他节点关系组合仍按实施矩阵保留未验边界。

# Atomic 已保存配置真实联调

## 范围与基线

- 前端与后端均为 WDI `fix/wdi-current` 工作树，基线分别为 `662d254e2f8b97f93021de548815470d2291c997` 和 `f3d5e400d3b5bd737124b57cf0a38e685432aab2`；保留既有并行工作区改动。
- 当前验收只关闭能力矩阵 G07 的本地真实页面、API、持久化和角色边界；不代表17项整体关闭或生产发布验收。
- 后端运行包 `build/runtime-jars/console.jar` 与当前 `batch-console-api` 构建产物 SHA-256 相同。验收使用独立认证 Console `127.0.0.1:18181`、Vite `127.0.0.1:5181` 与本地 PostgreSQL；共享 `18080` Console 和 Orchestrator 未重启或修改。

## 验收结果

- 真实认证 Chromium 用例 1/1 通过、0 次重试。匿名 `/api/console/auth/me` 返回 401。
- TENANT_ADMIN 在 Atomic SQL 配置页面保存参数预设，将输入改为其他值后重新应用，页面值恢复为已保存参数；刷新页面后仍能在选择器中读取该预设。
- ADMIN 通过真实 API 创建第二条预设。PostgreSQL 独立查询确认两条记录均属于本例租户、执行器类型为 `sql`，参数分别为 `select 11` 与 `select 22`。
- 权限结果：ADMIN、TENANT_ADMIN 列表/创建均为 200；AUDITOR、TENANT_USER 列表/创建均为 403。
- 精确清理删除本例两条配置，配置残留为 0；租户、账号、Workflow 夹具和相关记录的清理计数均为 0。

## 证据

机器结果：[脱敏真实验收摘要](assets/atomic-config-2026-10-26/real-evidence.json)；页面截图：[保存配置并刷新复用](assets/atomic-config-2026-10-26/saved-config-applied.png)。摘要不保留临时租户、配置名称、账号或凭据。

## 命令与边界

- `E2E_SKIP_GLOBAL_SETUP=1 npm run test:e2e:atomic-config:real`，设置独立验收 URL 与本地 PostgreSQL 容器参数后运行。
- 此场景验证 SQL 参数配置保存与复用，不覆盖 Atomic Worker 实际任务执行、其他执行器参数、安全敏感值拒绝的完整运行时场景；相关能力和剩余矩阵状态继续以[实施计划](../engineering/backend-capability-alignment-plan-2026-10-25.md)为准。
- 本地真实联调不能代替生产部署或完整发布门禁。

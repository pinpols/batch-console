# 历史测试数据操作脚本

2026-10-25 全量复核将此处脚本与 SQL 从原 `e2e-data/` 操作入口隔离。保留原相对目录和原始内容供追溯；它们记录 2026 年 5 月 Phase 1 联调的认证、接口、模板和数据库假设，不能作为当前 WDI 的造数、清理、导入、RBAC 或验收方法。

- `_lib/auth.sh` 与其调用方依赖响应体 `accessToken` 和 Bearer；当前认证契约使用 HttpOnly Cookie 与 CSRF。
- API CRUD/边界/覆盖脚本包含已退役 Pipeline 定义路径或历史 payload；“全覆盖”仅是当时记录。
- `cleanup-*.sh` 会删除共享测试租户、配置或账号；`cleanup-tx.sh` 还有失败后返回成功的旧行为。
- `10-rbac-users/seed-users.sh` 声称没有用户创建 API，与当前 `POST /api/console/users` 相反。
- `seed-import-template-fixture.sh` 是历史 V29 测试数据一次性修补。
- `*.sql` 绕过当前 API 直接写数据库；`02-excel-edge-cases/generate.py` 修改历史模板副本。二者均不是当前 schema/fixture 权威来源。

本目录内容仅作历史证据，不执行。原脚本的相对 payload、XLSX 和数据目录依赖保留当时写法；移动后不承诺可独立运行。历史 payload、样本和 XLSX 暂留在上层各场景目录，其完整性由上层 `verify-data.sh` 读取核对，该核对不证明当前契约兼容。

当前入口：

- [前端测试指南](../../docs/testing/README.md)、[CI 与真实环境边界](../../docs/runbook/ci.md)。
- `scripts/local/fe-acceptance.sh` 与 `e2e/global-setup.cjs` / `e2e/global-teardown.cjs` 负责当前验收和隔离测试数据准备/回收；这些流程也有真实写入，应先确认测试环境与租户。
- 模板、schema 和测试包以[配对后端测试资料](../../../file-batch-system/test-data/tenant-config-packages/README.md)及后端 `ConfigPackageExcelSchema` 为准。

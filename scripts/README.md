# 前端脚本索引

脚本必须带 `# 用途：` 与 `# 用法：` 头注释，并由 [check-script-metadata.mjs](check-script-metadata.mjs) 校验本索引与文件一致。

## 门禁与治理

| 脚本                                              | 用途                                               |
| ------------------------------------------------- | -------------------------------------------------- |
| `scripts/check-api-drift.sh`                      | 检查后端 OpenAPI 与前端生成类型是否漂移。          |
| `scripts/check-shell-scripts.sh`                  | 校验 Shell 语法与 ShellCheck 告警。                |
| `scripts/check-shell-portability.mjs`             | 检查 Shell 在 Linux 与 macOS Bash 3.2 下的兼容性。 |
| `scripts/check-script-metadata.mjs`               | 检查脚本头注释与本索引。                           |
| `scripts/check-diff-coverage.mjs`                 | 校验变更新增行的覆盖率门槛。                       |
| `scripts/check-test-quarantine.mjs`               | 阻止静默跳过并要求隔离声明。                       |
| `scripts/check-flaky-results.mjs`                 | 校验 flaky 用例的责任人与到期日。                  |
| `scripts/check-version-alignment.sh`              | 校验前后端运行时版本对齐。                         |
| `scripts/ci.sh`                                   | 本地无后端静态门禁总入口。                         |
| `scripts/ci/check-backend-validation-coverage.sh` | 校验后端验证覆盖证据。                             |
| `scripts/ci/resolve-backend-openapi.sh`           | 解析配对后端 OpenAPI 契约来源。                    |
| `scripts/ci/run-gate.sh`                          | 按分组与模式执行门禁并传播结果。                   |
| `scripts/ci/gitleaks-scan.sh`                     | 在可解析的提交范围内运行 gitleaks。                |
| `scripts/ci/test-gate-result-collection.sh`       | 门禁结果与聚合模式自测。                           |
| `scripts/verify-governance.sh`                    | 本地治理门禁总入口。                               |

## 开发与文档

| 脚本                    | 用途                                   |
| ----------------------- | -------------------------------------- |
| `scripts/dev-server.sh` | 启动前端开发服务器。                   |
| `scripts/dev-stack.sh`  | 构建文档后由 SPA 同进程提供 `/docs/`。 |
| `scripts/docs-build.sh` | 构建前后端统一 VitePress 站点。        |
| `scripts/docs-lib.sh`   | 统一文档站路径与端口清理。             |
| `scripts/docs-serve.sh` | 启动统一文档站。                       |
| `scripts/kill-fe.sh`    | 终止前端 dev 服务。                    |

## 测试与验收

| 脚本                             | 用途                          |
| -------------------------------- | ----------------------------- |
| `scripts/gen-api-types.sh`       | 从后端 OpenAPI 生成前端类型。 |
| `scripts/local/fe-acceptance.sh` | 前端全链路验收。              |
| `scripts/local/health-check.sh`  | 前端基建健康检查。            |
| `scripts/test-e2e.sh`            | 运行 Playwright E2E。         |
| `scripts/test-unit.sh`           | 运行 Vitest 单测。            |

## 公共库

| 脚本                         | 用途                             |
| ---------------------------- | -------------------------------- |
| `scripts/lib/gate-result.sh` | 门禁状态、分组与结果格式公共库。 |

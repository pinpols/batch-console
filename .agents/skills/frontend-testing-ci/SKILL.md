---
name: frontend-testing-ci
description: 规划、执行或修复前端 lint、typecheck、i18n、Vitest、Playwright、bundle size、API drift、CI workflow 和 PR/full gate 时使用。
---

# 前端测试与 CI 门禁

## 测试分层

- `npm run lint:check` 检查代码风格；`npm run typecheck` 检查类型；`npm run check:i18n` 检查多语言 key；`npm run gen:api:check` 检查 OpenAPI 漂移。
- 测试数据和持久化键事实来源由 `npm run check:test-fixture-sources` 守护；测试专属值和独立契约预期不机械抽成全局常量。
- `npm run test:unit` 覆盖 util、API、store 和 composable；SFC 测试只在收益明确时使用。
- Playwright 主要覆盖桌面关键用户路径；移动端默认不写自动化，除非新增独立业务逻辑或修复移动端独有回归。
- `npm run test:e2e` 是排除 `@slow` 的常规套件；`npm run test:e2e:all` 才是包含慢场景的发布验收全量套件；视觉基线单独运行 `npm run test:e2e:visual`。
- `npm run build` 是类型、i18n 和 Vite 构建的组合验证，不等于真实后端联调。

## 写测试

- Vitest 文件与被测文件同目录，命名 `xxx.test.ts`；`describe` 用被测对象短名，`it` 描述行为，不用 `should` 前缀。
- mock 使用 `vi.mock` + `vi.mocked`，每个用例前 `mockReset()`；不要引入 jest/chai/sinon。
- Playwright 要使用稳定选择器和业务结果断言，不依赖脆弱延时或截图偶然一致。

## CI 处理

- PR gate、full-ci-gate、staging-gate 角色不同；skipped/cancelled/timed_out 不能报告为通过。
- Staging gate 必须连接真实环境并运行 `test:e2e:all`、安全响应头检查及标记的跨浏览器路由冒烟；URL、账号、健康检查或版本证据不足时失败，不降级为成功的空跑。
- 失败先读对应 job 日志和真实退出码；不要只因为本地构建通过就认定线上失败是环境问题。
- workflow 或门禁变更要同步 `docs/runbook/ci.md`，并考虑 API drift、i18n、audit、Lighthouse、Docker/Trivy 的触发范围。
- 本地 `preflight:changed` 对选中的增量检查快速失败；PR/Full Gate 通过 `run-gate.sh` 汇总独立检查，`verify-governance.sh` 在聚合模式下记录子门禁失败并继续，末尾统一报告。依赖安装、运行环境和步骤间产物等基础前置失败仍会阻断后续依赖步骤。

## 本地入口

- 快速按变更检查使用 `npm run preflight:changed`；跨领域治理细节加载 `frontend-engineering-governance`。
- 不依赖后端的完整检查使用 `npm run verify:local`。
- 真实业务验收使用 `bash scripts/local/fe-acceptance.sh`；缺少后端或 preview 时不能宣称全流程通过。

## 报告

报告要列出实际运行命令、结果、未运行项和原因。不要在长期文档固化测试数量；涉及真实用户路径时说明是否连到真实后端或仅使用 mock/fixture。

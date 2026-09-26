---
name: frontend-testing-ci
description: 规划、执行或修复前端 lint、typecheck、i18n、Vitest、Playwright、bundle size、API drift、CI workflow 和 PR/full gate 时使用。
---

# 前端测试与 CI 门禁

## 测试分层

- `npm run lint:check` 检查代码风格；`npm run typecheck` 检查类型；`npm run check:i18n` 检查多语言 key；`npm run gen:api:check` 检查 OpenAPI 漂移。
- `npm run test:unit` 覆盖 util、API、store 和 composable；SFC 测试只在收益明确时使用。
- Playwright 主要覆盖桌面关键用户路径；移动端默认不写自动化，除非新增独立业务逻辑或修复移动端独有回归。
- `npm run build` 是类型、i18n 和 Vite 构建的组合验证，不等于真实后端联调。

## 写测试

- Vitest 文件与被测文件同目录，命名 `xxx.test.ts`；`describe` 用被测对象短名，`it` 描述行为，不用 `should` 前缀。
- mock 使用 `vi.mock` + `vi.mocked`，每个用例前 `mockReset()`；不要引入 jest/chai/sinon。
- Playwright 要使用稳定选择器和业务结果断言，不依赖脆弱延时或截图偶然一致。

## CI 处理

- PR gate、full-ci-gate、staging-gate 角色不同；skipped/cancelled/timed_out 不能报告为通过。
- 失败先读对应 job 日志和真实退出码；不要只因为本地构建通过就认定线上失败是环境问题。
- workflow 或门禁变更要同步 `docs/runbook/ci.md`，并考虑 API drift、i18n、audit、Lighthouse、Docker/Trivy 的触发范围。

## 报告

报告要列出实际运行命令、结果、未运行项和原因。涉及真实用户路径时说明是否连到真实后端或仅使用 mock/fixture。

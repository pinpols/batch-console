---
name: frontend-engineering-governance
description: 修改或审查前端架构边界、环境变量登记、可维护性阈值、GitHub Actions 安全、SBOM 许可证、Changelog 联动和提交前治理门禁时使用。
---

# 前端工程治理

## 适用边界

- 本技能处理跨模块工程约束和可重复门禁；业务测试走 `frontend-testing-ci`，部署运行时走 `frontend-deploy-runtime`，文档内容治理走 `frontend-docs-release-governance`。
- 仓库脚本和 `package.json` 是执行口径，技能文件只记录选择规则，不复制检查实现或瞬时统计。

## 变更前判断

按改动范围选择最小但完整的检查：

| 改动 | 必查项 |
|---|---|
| `src/**` | `check:architecture`、`check:maintainability` |
| `.env*`、Docker、Compose、workflow | `check:env` |
| `.github/workflows/**` | `check:workflows`，可用时再跑 `actionlint` |
| `package.json`、`package-lock.json` | `check:version`、`compliance:check` |
| 当前文档或索引 | `check:docs`；文档站入口变化再跑对应 build |
| 用户、契约或部署影响变更 | `check:changelog` |

不要为绕过检查添加宽泛例外。确需例外时，限定到最小文件或依赖边，并用中文说明删除条件。

## 三层入口

1. 日常提交前运行 `npm run preflight:changed`；需要覆盖未暂存和未跟踪文件时运行 `npm run preflight:changed:all`。
2. 无后端的完整本地门禁运行 `npm run verify:local`。它不修改源码，也不代表真实业务验收。
3. 需要真实浏览器和后端证据时运行 `bash scripts/local/fe-acceptance.sh`。后端、preview 或真实审计缺失必须失败或明确 SKIP，不能记成通过。

## 结果处理

- 错误必须修复后重跑；维护性观察项是非阻断警告，但新增超限文件或继续扩大既有大文件时应优先拆分。
- `compliance:check` 发现漂移时运行 `npm run compliance:sbom` 并提交确定性生成结果，不手工编辑 SBOM 或许可证清单。
- 报告区分 PASS、FAIL、SKIP 和未运行，并写明真实后端、mock、preview 或 staging 的证据边界。

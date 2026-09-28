# 前端运行时与依赖版本

## Node.js

- `package.json` 的 `engines.node` 是开发和构建约束：Node 24（`^24`）。
- 本地默认版本由 `.node-version` 和 `.nvmrc` 统一选择 Node 24。
- Docker builder 使用精确标签 `node:24.21.0-alpine3.24`；Nginx runtime 使用精确标签 `nginx:1.30.5-alpine3.24`。升级必须同步修改 Dockerfile，并经 CI build + Trivy 验证。
- 安装依赖必须使用提交的 `package-lock.json` 与 `npm ci`，不要用 `npm install` 更新锁文件之外的运行环境。
- `pr-gate`、`full-ci-gate`、`frontend-ci`、镜像构建和本地版本文件统一使用 Node 24；不再维护双运行时门禁。

后端维护的[运行时兼容约束](https://github.com/pinpols/file-batch-system/blob/main/docs/architecture/runtime-compatibility-contract-2026-09-01.md)是跨仓库基线。升级 Node 时同步审查 SDK `engines`、CI 矩阵、Dockerfile、锁文件和该基线。Docker 基础镜像必须使用完整上游版本和 Alpine 次版本，不使用 `latest`、`stable`、仅 major 或仅 minor 标签。

## 依赖升级

- `package.json` 的直接依赖范围和 `package-lock.json` 一起评审；CI 与容器构建使用 `npm ci`。前端 CI 不覆盖依赖后端服务的 Playwright E2E，E2E 仍须在联调环境执行。
- 先检查 `npm outdated` 和 `npm audit`，区分 semver 范围内更新、主版本升级、传递依赖漏洞和仅开发工具依赖。
- 不使用 `npm audit fix --force`。主版本升级应逐项检查迁移说明并通过 lint、typecheck、unit、build、bundle size 和文档构建。
- 浏览器 E2E 依赖可访问的后端和 Playwright 浏览器，需在对应集成环境验证，不能以纯构建结果代替。

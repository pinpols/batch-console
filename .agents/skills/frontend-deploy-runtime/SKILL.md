---
name: frontend-deploy-runtime
description: 修改或审查前端 Docker、Nginx、环境变量、PWA、构建产物、版本号、部署脚本和运行时配置时使用。重点保持本地、容器和生产入口一致。
---

# 前端部署与运行时治理

## 运行时边界

- `main` 是唯一常驻分支，部署文件是产品的一部分；Dockerfile、Compose、Nginx、脚本和 GitHub Actions 要跟应用代码同源维护。
- Node 版本以 `.node-version`、`.nvmrc`、`package.json engines` 和 CI 镜像共同约束；调整时同步文档和检查脚本。
- 前端运行时配置要明确是 build-time 还是 container/runtime 注入，不能让本地 `.env`、Docker、Nginx 和 CI 各自漂移。

## 修改检查

1. Docker/Nginx 变化要检查静态资源缓存、SPA fallback、API 反代、gzip/brotli、安全 header、上传大小和健康检查。
2. 版本发布相关变化要同步 `package.json`、`package-lock.json`、release-please 配置和 README/运行手册。
3. PWA、图标、manifest 或 service worker 变化要验证缓存更新策略，避免旧前端长期持有旧 API 契约。
4. 部署脚本要兼容 Linux/macOS/PowerShell 的既有边界，路径和端口不要写死到个人机器。
5. 新增或调整 `VITE_*`、容器运行时变量时同步 `config/frontend-env.json`，并运行 `npm run check:env`；不要让 `.env` 成为未登记的事实来源。
6. GitHub Actions 使用固定版本标签并声明顶层最小 `permissions`；workflow 变化运行 `npm run check:workflows`，本机有 `actionlint` 时一并验证。

## 验证

- 轻量验证优先：`npm run check:version`、`npm run build`、`npm run docker:build` 或对应脚本。
- 无后端综合门禁使用 `npm run verify:local`；它不能替代 Docker 运行态、Lighthouse 或 staging 浏览器验收。
- 线上或 staging 验证要记录镜像/tag、后端地址、健康检查、Lighthouse/Trivy 等证据。
- 版本标签只能晋级同一 commit 已通过 staging 的不可变镜像；未构建镜像或未跑 staging 时，不要宣称部署链路已验证。

## 本地进程与发布脚本

- `scripts/dev-stack.sh`、`docs-serve.sh` 和 `kill-fe.sh` 使用 `docs-lib.sh` 确认本仓 Vite/VitePress 端口归属；`dev-server.sh` 有按端口强制停止进程的旧实现，启停前核对 PID、命令行和工作树，不把未知或其他仓进程当本仓服务。
- `scripts/gen-pwa-icons.mjs` 生成图标文件，`check:version`、`check:env` 和 `scripts/check-security-headers.mjs` 分别核版本/环境事实源与真实响应头。安全头检查需要显式 `FRONTEND_BASE_URL`，静态配置不能替代运行响应证据。
- `scripts/prepare-platform-release.mjs` 由配对后端联合版本流程调用，参数是 bump 类型、目标版本和 `RELEASE_DATE`；会改版本来源和根 Changelog。版本准备、镜像构建、staging 晋级和 tag/生产发布是独立动作，使用当前发布 Runbook 判断范围。
- 旧常驻部署分支同步脚本已归档，当前部署与应用代码共同维护在 main；脚本与配置归属见 `docs/engineering/script-skill-routing.md`。

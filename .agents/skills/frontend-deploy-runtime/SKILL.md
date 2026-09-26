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

## 验证

- 轻量验证优先：`npm run check:version`、`npm run build`、`npm run docker:build` 或对应脚本。
- 线上或 staging 验证要记录镜像/tag、后端地址、健康检查、Lighthouse/Trivy 等证据。
- 未构建镜像或未跑 staging 时，不要宣称部署链路已验证。

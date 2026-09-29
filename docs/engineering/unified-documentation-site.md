# 统一文档站

## 访问入口

| 环境 | 控制台 | 文档 |
|---|---|---|
| 本地开发 | `http://localhost:5173/` | `http://localhost:5173/docs/` |
| 生产 | 同一域名的 `/` | 同一域名的 `/docs/` |

文档只有一个 VitePress 站点、一个搜索索引。本地 5174 是仅供 Vite 代理的预览端口，不是第二个文档站；生产由控制台 Nginx 直接提供静态产物。

## 内容来源与路径

| 权威源 | 站内路径 | 维护归属 |
|---|---|---|
| 本仓 `docs/` | `/docs/frontend/` | 前端仓库 |
| 配对后端仓 `docs/` | `/docs/backend/` | 后端仓库 |
| 构建期生成的首页 | `/docs/` | `scripts/docs-prepare.mjs` |

构建脚本只读复制两仓文档到被 Git 忽略的 `tools/docs-bridge/frontend/content/`。后端源仓不写入软链或索引，生成目录不可手工维护。两仓的 `README.md` 分别对应 `/docs/frontend/` 和 `/docs/backend/`。旧 `/fe-docs/*` 返回 `410 Gone`，未加 `backend/` 前缀的后端页面路径返回 `404`；均不设兼容入口。

## 构建与运行

两仓默认同级放置。`FRONTEND_DOCS_ROOT` 默认是本仓 `docs/`，`BACKEND_DOCS_ROOT` 默认是同级后端仓的 `docs/`；两者都可覆盖为其他文档源目录。相对路径从前端仓库根目录解析。缺少任一权威源时构建失败，不发布不完整站点。

```bash
npm run docs:build
npm run dev:all
```

自定义来源示例：

```bash
FRONTEND_DOCS_ROOT=/workspace/console-docs BACKEND_DOCS_ROOT=/workspace/backend-docs npm run docs:build
```

只运行文档预览使用 `npm run docs:serve`。`make dev-stack` 会先构建文档，再启动前端与一个预览服务。文档源变化后需重新构建；前端 Vite 的热更新不负责重建 VitePress 静态产物。

CI 的文档任务检出配对后端仓并运行 `docs:build`；Docker 构建通过 `backend-docs` BuildKit context 注入同一权威源。`docs:size` 对普通 JS chunk 和统一搜索索引分别设置预算。

## 权限边界

生产 `/docs/` 由 Nginx `auth_request` 调用后端 `/api/console/auth/check`，同一个站内的产品、工程与后端文档遵循同一登录门槛。当前未按角色细分文档权限；不可将此镜像作为公开匿名文档站使用。本地 5174 仅监听 loopback，但 5173 开发代理不提供生产级鉴权。

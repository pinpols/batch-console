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

超长历史证据按 `scripts/docs-prepare.mjs` 中的显式清单分卷发布：只改生成副本，权威源不删减或改名。每卷保留完整 Markdown 块、原始行范围和原章节锚点，目录记录原文 SHA-256；生成的 `.publication-manifest.json` 可用于复核完整性。不可安全拆开的超大块、HTML 容器或引用式链接使构建失败，不截断正文。`*.part-NNN` 是生成发布名，不是源文档的日期或生命周期后缀。

原路径保留目录；旧章节锚点由受信任主题读取页面导航元数据，跳到同目录、同基名分卷，保留查询参数和锚点。Markdown HTML 仍禁用，正文不得注入跳转脚本。分卷内章节链接经原目录定位正确卷，前后卷和相对资料链接保持可用。

两仓分别通过 `docs/.docsignore` 管理不进入发布站的仓库内资料。规则是一行一个、相对各自 `docs/` 的文件或目录前缀；支持空行和 `#` 注释，不支持通配符、绝对路径或 `..`。构建器始终额外排除 `.DS_Store`、`node_modules`、`.git`、`.vitepress`、`.docsignore` 和符号链接。已被替代且无现行依赖的历史页、技术试验、测试数据、规模统计和一次性验证证据继续保留在 Git 中，但不进入 VitePress 页面与搜索索引；现行设计、治理和可追溯证据继续发布，避免产生不可用的站内链接。

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

自定义来源目录可以不提供 `.docsignore`，此时只应用内置技术目录排除。CI 与生产构建使用仓库内已提交规则，禁止在机器上维护另一份隐式排除清单。

只运行文档预览使用 `npm run docs:serve`。`make dev-stack` 会先构建文档，再启动前端与一个预览服务。文档源变化后需重新构建；前端 Vite 的热更新不负责重建 VitePress 静态产物。

CI 的文档任务检出配对后端仓并运行 `docs:build`；Docker 构建通过 `backend-docs` BuildKit context 注入同一权威源。构建先执行 `test:docs-publication`，再准备、编译并检查体积。`docs:size` 对普通 JS chunk 设置 raw 850 KB / gzip 220 KB 预算；统一搜索索引设置 raw 4.5 MB / gzip 1.23 MB 预算。索引 gzip 预算包含少量跨构建环境余量，以覆盖 VitePress 并发索引的序列化差异；raw 上限不变。后端历史变更日志、带日期的后端设计稿、ADR 和工程标准只将一至三级标题纳入搜索索引，页面正文仍完整发布；无日期的当前设计、API、产品指南与运维文档保留全文搜索。

发布算法、主题导航或构建输入变更后，除完整构建外，应在新构建的预览中实际验证旧锚点、末卷和前后卷／目录导航。已有预览服务可能缓存构建前的文件；只重启本任务拥有的预览实例后复验，不将旧页面当作新构建结果。

## 权限边界

生产 `/docs/` 由 Nginx `auth_request` 调用后端 `/api/console/auth/check`，同一个站内的产品、工程与后端文档遵循同一登录门槛。当前未按角色细分文档权限；不可将此镜像作为公开匿名文档站使用。本地 5174 仅监听 loopback，但 5173 开发代理不提供生产级鉴权。

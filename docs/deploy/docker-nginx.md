# 前端 Docker / Nginx 部署

## 镜像组成

多阶段构建,产物 ~50MB:

| 阶段 | 基础镜像 | 用途 |
|---|---|---|
| `build` | `node:20-alpine` | `npm ci` + `vite build` 出 `dist/` |
| `runtime` | `nginx:1.27-alpine` | 拷 `dist` 到 `/usr/share/nginx/html`,装 nginx 配置 |

## 文件清单

| 文件 | 用途 |
|---|---|
| `Dockerfile` | 多阶段构建定义 |
| `.dockerignore` | 排除 node_modules / dist / git / e2e / docs-site 等 |
| `nginx/nginx.conf` | nginx 主配置(全局 gzip / 日志 / sendfile / worker) |
| `nginx/default.conf.template` | server block 模板,启动时 envsubst 替换 `${BACKEND_UPSTREAM_HOST}` / `${NGINX_PORT}` |
| `docker-compose.yml` | 单服务 compose,默认反代到 `host.docker.internal:18080` |

## 快速跑起

```bash
# 用 compose(推荐:支持自动重启 + healthcheck + 日志旋转)
docker compose up -d --build

# 自定义 BE 地址(默认 host.docker.internal:18080)
BACKEND_UPSTREAM_HOST=10.0.0.5:18080 docker compose up -d --build

# 自定义对外端口(默认 8080,容器内 80)
HOST_PORT=80 docker compose up -d --build

# 单纯 docker run
npm run docker:build
npm run docker:run
```

打开 <http://localhost:8080>。

## 关键设计

### 整体路由分布

```
浏览器 → nginx
        ├── /                → Vue SPA 静态(/usr/share/nginx/html)
        ├── /api/*           → 反代 console-api:18080(透传 SSE / WebSocket)
        ├── /docs/*          → VitePress 文档(/var/www/batch-docs)
        │                      经 auth_request 鉴权
        ├── /__auth_check    → internal,子请求 BE /api/console/auth/check
        └── /healthz         → 200 ok
```

### SPA fallback
vue-router history 模式 → `try_files $uri $uri/ /index.html`,所有未知路径回首页让前端路由处理。

### `/api/*` 反代
- 透传 `Host / X-Real-IP / X-Forwarded-For/Proto/Host` 头(BE 可拿到真实客户端信息)
- `proxy_buffering off` + `proxy_read_timeout 3600s` 支持 SSE 长连接(`/api/console/ops/summary/events`)
- `Upgrade / Connection` 头保留(WebSocket 预留)

### `/docs/*` 文档站点 + 鉴权
- 静态产物:`docs-site/.vitepress/dist`(VitePress base 配置 `/docs/` 与 nginx alias 对齐)
- **内嵌 auth_request**:每个 docs 资源请求都触发一次 internal 子请求到 BE `/api/console/auth/check`
- BE 期望:`GET /api/console/auth/check` 拿 cookie / Authorization 头 → 200/204 通过,401/403 拒绝
- 鉴权 SLO:子请求 connect/read 超时各 1-2s,超时即拒
- Docs assets 一样长缓存(`/docs/assets/*` immutable),`docs/index.html` 不缓存

### 缓存策略
| 路径 | Cache-Control |
|---|---|
| `/assets/*.{js,css,woff2,...}` | `public, max-age=31536000, immutable`(hash 命名,1 年) |
| `/index.html` | `no-cache, no-store, must-revalidate`(每次都拉新) |
| 其它 | `no-cache`(走协商缓存) |

### 安全头
`X-Content-Type-Options / X-Frame-Options / Referrer-Policy / X-XSS-Protection / Permissions-Policy` 全开,关掉 `server_tokens`。

### 健康检查
- `GET /healthz` 返 `200 ok`,Docker `HEALTHCHECK` 每 30s 探一次
- compose `unless-stopped` 重启策略

### 日志
- 格式:JSON 行,带 `time / status / rt / upstream_rt / trace`,直接喂 ELK / Loki 即可
- 旋转:compose `max-size: 10m, max-file: 3`,防写满磁盘

## 构建模式

```bash
# 默认 build:fast(只跑 vite build,不重复 vue-tsc — CI 应已跑过 typecheck)
docker compose up -d --build

# 严格构建(跑 vue-tsc 全量类型检查,慢 ~20s)
BUILD_MODE=build docker compose up -d --build
```

## VitePress 文档构建(跨仓)

`docs-site/.vitepress/config.ts` 用 `srcDir: '../../file-batch-system/docs'` 跨仓引用 BE 仓的 markdown,**两个仓必须放在同一父目录**(参见 `AGENTS.md`)。

构建有 2 种方式:

**方式 1:扩展 build context 到父目录**(自动跑 vitepress build)

```bash
# Dockerfile 在父目录可见 file-batch-system/docs 时会自动跑 npm run docs:build
docker build -f batch-console/Dockerfile -t batch-console:latest ..
```

**方式 2:CI 预构建 + 单仓 docker build**(推荐 CI 用)

```bash
# 在 CI 上先 cd batch-console && npm install && npm run docs:build
# 产物在 docs-site/.vitepress/dist;docker build 直接拷
docker build -t batch-console:latest .
```

**方式 3(回退)**:不构建文档,镜像里 `/docs/` 返回占位页,SPA 主站不受影响。

> Dockerfile 启动时检测 `/app/../file-batch-system/docs` 是否存在 — 存在自动跑 docs:build,否则装占位页。

## BE 地址注入方式

| 场景 | `BACKEND_UPSTREAM_HOST` 值 |
|---|---|
| macOS / Windows 本机 BE | `host.docker.internal:18080` |
| Linux 本机 BE | `host.docker.internal:host-gateway` 已自动加 extra_hosts,同上 |
| K8s / 集群内 BE | `backend-svc.batch.svc.cluster.local:18080` 或 service 名 |
| 外部 BE | 直接 IP / DNS,如 `10.0.0.5:18080` |

## 排查

```bash
# 进容器看 nginx 渲染后的 conf
docker compose exec frontend cat /etc/nginx/conf.d/default.conf

# 看实时访问日志
docker compose logs -f frontend

# 测试反代是否通
docker compose exec frontend curl -i http://backend/api/console/healthz

# 检查健康
docker inspect --format='{{.State.Health.Status}}' batch-console
```

## CI/CD 集成示例

```yaml
# GitHub Actions:tag 推送后构建并推到 GHCR
- name: Build & push
  uses: docker/build-push-action@v5
  with:
    context: .
    push: true
    tags: |
      ghcr.io/${{ github.repository }}/frontend:${{ github.ref_name }}
      ghcr.io/${{ github.repository }}/frontend:latest
    build-args: BUILD_MODE=build  # CI 走严格类型检查
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

## 不打入镜像的内容

由 `.dockerignore` 排除:
- `node_modules` / `dist`(在构建阶段重新生成)
- `.git` / `.github` / `.idea` / `.vscode` / `.claude`
- e2e 相关:`test-results / playwright-report / e2e/.auth`
- `docs-site` / `docs`(单独 vitepress 部署)
- `.env.local` / `.env.*.local`(env 通过 `-e` 注入)
- `.png` / `.xlsx` / `oldfiles` / `.DS_Store`

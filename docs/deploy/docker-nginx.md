# 前端 Docker / Nginx 部署

## 制品内容

镜像由 Node 24 构建阶段和 Nginx 1.27 运行阶段组成，包含 Vue SPA 与从配对后端权威文档构建的 `/docs/`。文档通过 BuildKit named context 注入；缺少文档源时构建直接失败，不生成占位页。

```bash
# 两仓位于同一父目录时
npm run docker:build

# Compose 同样使用 ../file-batch-system/docs
docker compose up -d --build
```

手动构建必须显式提供文档上下文：

```bash
docker build \
  --build-context backend-docs=../file-batch-system/docs \
  --build-arg VITE_GIT_SHA="$(git rev-parse HEAD)" \
  -t batch-console:local .
```

## 路由与缓存

| 路径 | 行为 | 缓存 |
|---|---|---|
| `/` | Vue Router history fallback | `no-cache` |
| `/index.html` | SPA 入口 | `no-store` |
| `/version.json` | 版本和 commit 校验 | `no-store` |
| `/assets/*` | hash 静态资源 | 一年 immutable |
| `/api/*` | 反向代理 Console API，支持 SSE/WebSocket | 不代理缓存 |
| `/docs/*` | VitePress，先通过后端 `auth_request` 鉴权 | assets immutable，入口不缓存 |
| `/healthz` | 容器健康检查 | 不缓存 |

`BACKEND_UPSTREAM_HOST` 在容器启动时注入；Compose 默认 `host.docker.internal:18090`，生产必须设置为真实 Console API 地址。

## 安全头

`nginx/snippets/security-headers.conf` 是统一入口，所有自行设置缓存头的 location 都显式包含该文件，避免 Nginx `add_header` 继承规则造成安全头丢失。当前包含 CSP、HSTS、frame、MIME、Referrer 与 Permissions Policy。

HSTS 只有 HTTPS 响应才生效。若 TLS 在 ingress/CDN 终止，平台负责人仍须在最终公网响应执行：

```bash
curl -sSI https://console.example.com/ | grep -Ei 'strict-transport|content-security|x-frame|permissions-policy'
```

CSP 新增外部 API、Sentry 或资源域名时应按最小域名扩展 `connect-src` 等指令，不得使用通配 `*`。

## 构建期配置

`VITE_SENTRY_DSN`、遥测开关和端点通过 Docker build args 写入静态制品，定义见[环境变量治理](../engineering/environment-variables.md)。这些变量不是容器启动后动态配置；修改后必须重新构建镜像。

## 发布与回滚

主分支生成 `sha-*` 多架构镜像，版本 tag 只晋级已通过 staging 的同一 digest。流程见[发布晋级](../runbook/release-promotion.md)，回滚见[回滚手册](../runbook/rollback.md)。不得直接从工作目录构建未验收的生产版本。

## 排查

```bash
docker compose ps
docker compose logs -f frontend
docker compose exec frontend nginx -t
docker compose exec frontend cat /etc/nginx/conf.d/default.conf
curl -sS http://localhost:8080/version.json
curl -sSI http://localhost:8080/index.html
```

Compose 使用 `json-file` 日志轮转，默认每个文件 10 MiB、保留 3 份。生产平台可接入 Loki/ELK，但不得依赖容器内无限期留存。

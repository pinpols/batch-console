# 裸 Linux + Nginx 部署

本手册适用于专用 Ubuntu/Debian 主机，以系统 Nginx 在同一域名提供控制台、`/docs/` 和 `/api/`。构建机生成静态制品；服务主机不运行 Node、Vite 或 5174 文档预览进程。已有多个站点共用 Nginx 时，先由平台运维合并虚拟主机配置，不要直接执行本手册中的首次安装命令。

## 前置条件

- 使用已通过 CI/staging 的同一前端提交；构建机有 Node 24、锁文件依赖和配对后端的 `docs/`。后端文档只在构建时读取，不需要部署后端源码到服务主机。
- Console API 在服务主机可达；示例使用 `127.0.0.1:18080`，实际部署以真实地址为准。`GET /api/console/auth/check` 必须可用，未登录返回 401、登录后返回 204。
- 域名、可信 TLS 证书及其续期机制已由平台准备好。以下示例域名为 `console.example.com`；生产必须替换。仅在内网临时验收时可用 HTTP，不要让登录 Cookie 经公网明文传输。
- 本手册假设 Nginx 包含 `http_auth_request` 模块，且配置的 `http` 块包含 `/etc/nginx/conf.d/*.conf`。安装后以 `nginx -V` 和 `nginx -t` 验证。

静态目录沿用容器模板中的路径：`/usr/share/nginx/html` 提供 SPA，`/var/www/batch-docs` 提供统一文档站。两者都指向 `/srv/batch-console/current` 下的同一发布版本；不要在这些入口目录直接修改文件。

## 构建与交付

在可信构建机的前端仓库根目录执行。两仓默认位于同一父目录；路径不同时显式设置 `FRONTEND_DOCS_ROOT` 和 `BACKEND_DOCS_ROOT`。

```bash
SHA=$(git rev-parse HEAD)
BACKEND_SHA=$(git -C ../file-batch-system rev-parse HEAD)
npm ci --no-audit --no-fund
VITE_GIT_SHA="$SHA" npm run build
FRONTEND_DOCS_ROOT=docs BACKEND_DOCS_ROOT=../file-batch-system/docs npm run docs:build

tar --no-xattrs -C dist -czf "batch-console-spa-$SHA.tar.gz" .
tar --no-xattrs -C tools/docs-bridge/frontend/.vitepress/dist -czf "batch-console-docs-$SHA.tar.gz" .
printf 'frontend=%s\nbackend-docs=%s\n' "$SHA" "$BACKEND_SHA" > "batch-console-source-$SHA.txt"
sha256sum "batch-console-spa-$SHA.tar.gz" "batch-console-docs-$SHA.tar.gz" \
  "batch-console-source-$SHA.txt" > "batch-console-$SHA.sha256"
```

`--no-xattrs` 避免 macOS 构建机把本机扩展属性写入 tar，导致 Linux 解包时产生大量无关告警；它不改变静态文件内容。

将制品、校验文件、来源记录和两份 Nginx 配置源文件传到部署主机；以下 `deploy` 是具备 sudo 权限的发布账号示例：

```bash
DEPLOY_HOST=console.example.com
ssh "deploy@$DEPLOY_HOST" "mkdir -p /tmp/batch-console-$SHA"
scp "batch-console-spa-$SHA.tar.gz" "batch-console-docs-$SHA.tar.gz" \
  "batch-console-source-$SHA.txt" "batch-console-$SHA.sha256" \
  nginx/default.conf.template nginx/snippets/security-headers.conf \
  "deploy@$DEPLOY_HOST:/tmp/batch-console-$SHA/"
```

发布记录应包含前后端完整提交 SHA、制品校验值、后端地址和上一版本目录。不要在生产主机执行 `npm run dev` 或 `vitepress preview`。

## 首次准备主机

以下命令以专用 Ubuntu/Debian 主机为例。其他发行版需调整包管理器、Nginx 工作用户和 systemd 单元名。

```bash
SHA='replace-with-verified-full-commit-sha'
cd "/tmp/batch-console-$SHA"
sudo apt update
sudo apt install nginx gettext-base rsync
nginx -V 2>&1 | grep -- '--with-http_auth_request_module'
id www-data
sudo install -d -m 0755 /srv/batch-console/releases /usr/share/nginx /var/www /etc/nginx/snippets
sudo install -m 0644 security-headers.conf /etc/nginx/snippets/security-headers.conf
```

以上命令在上传文件所在的 `/tmp/batch-console-<SHA>` 目录执行；部署机不需要完整源码。若 `nginx -V` 没有 `auth_request`，先更换含该模块的 Nginx 包，不能通过删掉文档鉴权来绕过配置检查。确认 `/usr/share/nginx/html` 没有承载其他站点；如果它只是发行版默认占位目录，先备份该目录，再建立符号链接。

## 安装发布制品

在部署机设置本次版本的完整 SHA，并在已校验制品的暂存目录执行：

```bash
SHA='replace-with-verified-full-commit-sha'
cd "/tmp/batch-console-$SHA"
sha256sum -c "batch-console-$SHA.sha256"
RELEASE="/srv/batch-console/releases/$SHA"
sudo install -d -m 0755 "$RELEASE/spa" "$RELEASE/docs"
sudo tar --no-same-owner -xzf "batch-console-spa-$SHA.tar.gz" -C "$RELEASE/spa"
sudo tar --no-same-owner -xzf "batch-console-docs-$SHA.tar.gz" -C "$RELEASE/docs"
sudo install -m 0640 "batch-console-source-$SHA.txt" "$RELEASE/source.txt"

# 保留上一个版本的 hash 资源，避免旧页面在发布切换后请求脚本时得到 404。
if [ -L /srv/batch-console/current ]; then
  PREVIOUS=$(readlink -f /srv/batch-console/current)
  if sudo test -d "$PREVIOUS/spa/assets"; then
    sudo rsync -a --ignore-existing "$PREVIOUS/spa/assets/" "$RELEASE/spa/assets/"
  fi
  if sudo test -d "$PREVIOUS/docs/assets"; then
    sudo rsync -a --ignore-existing "$PREVIOUS/docs/assets/" "$RELEASE/docs/assets/"
  fi
fi

sudo test -f "$RELEASE/spa/index.html"
sudo test -f "$RELEASE/spa/version.json"
sudo test -f "$RELEASE/docs/index.html"
sudo test -f "$RELEASE/docs/frontend/index.html"
sudo test -f "$RELEASE/docs/backend/index.html"
sudo chown -R root:www-data "$RELEASE"
sudo find "$RELEASE" -type d -exec chmod 0750 {} +
sudo find "$RELEASE" -type f -exec chmod 0640 {} +

sudo ln -sfnT "$RELEASE" /srv/batch-console/current.next
sudo mv -Tf /srv/batch-console/current.next /srv/batch-console/current
```

首次安装时，检查并备份 Nginx 包自带的 `/usr/share/nginx/html`，确认 `/var/www/batch-docs` 未被占用，然后只执行一次：

```bash
sudo ln -sT /srv/batch-console/current/spa /usr/share/nginx/html
sudo ln -sT /srv/batch-console/current/docs /var/www/batch-docs
```

`ln -sT` 在目标已存在时会失败；不要用 `-f` 覆盖其他站点。后续发布只切换 `current`，无需再修改这两个入口。旧版本目录至少保留到验收完成；hash 资源会逐版累积，定期按浏览器缓存窗口与回滚保留策略清理，不要在发布时直接删除仍可能被旧页面引用的资源。

## 配置 Nginx 与 HTTPS

复用仓库的 `nginx/default.conf.template`，仅替换明确列出的两个变量；不能对整个模板无参数执行 `envsubst`，否则 Nginx 的 `$uri`、`$host` 等运行时变量会被清空。专用主机示例直接由本机 Nginx 终止 TLS：

```bash
export BACKEND_UPSTREAM_HOST='127.0.0.1:18080'
export NGINX_PORT='443 ssl'
envsubst '${BACKEND_UPSTREAM_HOST} ${NGINX_PORT}' \
  < default.conf.template \
  | sudo tee /etc/nginx/conf.d/batch-console.conf >/dev/null
```

在 `/etc/nginx/conf.d/00-batch-console-tls.conf` 配置证书和 80 → 443 跳转（示例为专用主机；证书路径须替换为平台实际路径）：

```nginx
ssl_certificate /etc/letsencrypt/live/console.example.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/console.example.com/privkey.pem;

server {
    listen 80;
    server_name console.example.com;
    return 301 https://console.example.com$request_uri;
}
```

证书指令位于 `http` 上下文，由模板中 `listen 443 ssl` 的应用 server 继承。本方案只适合专用 Nginx 主机；多站点主机应把证书放进对应 server 块，并由平台团队管理虚拟主机。发行版默认站点若占用 80 或 443，先核查并停用对应站点，不能盲目覆盖。证书签发和续期按平台标准执行；可参考 [Ubuntu TLS 手册](https://ubuntu.com/server/docs/how-to/security/obtain-tls-certificates/)。

```bash
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

静态产物变更只需要切换 `current`；模板或证书变更必须先备份原配置，执行 `nginx -t` 成功后再 reload。Nginx 模板含 `/api/` 反代及 `/docs/` 的 `auth_request`，不要用只有 `try_files` 的简化配置替代它。

## 验收

用真实域名验证 TLS 和路由。未登录客户端以及登录后需要区分的状态如下：

| 请求 | 预期 |
|---|---|
| `GET /healthz`、`GET /version.json` | 200；版本 SHA 与制品一致 |
| `GET /` | 200，SPA 静态资源正常加载 |
| `GET /docs/`、`/docs/frontend/`、`/docs/backend/` | 401；登录后在浏览器中均为 200 |
| `GET /api/console/auth/check` | 未登录 401；登录后 204 |
| `GET /docs/architecture/` | 未登录 401；登录后 404，不提供旧后端路径兼容 |
| `GET /fe-docs/` | 410，不提供旧前端文档站兼容 |

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://console.example.com/healthz
curl -sS -o /dev/null -w '%{http_code}\n' https://console.example.com/docs/
curl -sS -o /dev/null -w '%{http_code}\n' https://console.example.com/docs/architecture/
curl -sS -o /dev/null -w '%{http_code}\n' https://console.example.com/fe-docs/
sudo journalctl -u nginx -n 100 --no-pager
```

上述 `curl` 未携带登录态，因此旧 `/docs/architecture/` 也会先被文档鉴权拒绝并返回 401；验证 404 时须使用已登录会话。`/version.json` 的 `gitSha` 应为本次构建的完整前端 SHA，不应是 `local`。

文档返回 500 通常先查 Console API 鉴权子请求和上游连通性；API 返回 502 先查 `BACKEND_UPSTREAM_HOST`。根路径显示发行版欢迎页时查默认站点或监听端口。`/docs/` 返回 404 时核查 `current/docs/index.html`、目录权限和 `alias`；前端 chunk 404 时核查发布制品、旧 hash 资源和浏览器缓存。没有真实登录验收时，不要宣称文档鉴权或完整页面已通过。

## 回滚

从发布记录取得旧版本的完整 SHA；确认目录仍存在后原子切回，不依赖上一次 shell 会话的变量：

```bash
PREVIOUS='/srv/batch-console/releases/replace-with-previous-full-commit-sha'
sudo test -d "$PREVIOUS/spa" && sudo test -d "$PREVIOUS/docs"
sudo ln -sfnT "$PREVIOUS" /srv/batch-console/current.next
sudo mv -Tf /srv/batch-console/current.next /srv/batch-console/current
sudo nginx -t
```

静态制品回滚不需要重启 Nginx。若本次也修改了 Nginx 配置或证书，单独恢复配置备份，`nginx -t` 成功后 `systemctl reload nginx`。回滚后重查 `/version.json`、登录、`/docs/` 和 API；不要删除尚在使用的发布目录。

## 参考

- [Docker / Nginx 部署](./docker-nginx.md)：容器部署方式及共同的路由、安全头约定。
- [统一文档站](../engineering/unified-documentation-site.md)：文档来源变量与路径规范。
- [Nginx auth_request 模块](https://nginx.org/en/docs/http/ngx_http_auth_request_module.html)：2xx 放行，401/403 拒绝，其它状态作为错误处理。
- [Ubuntu Nginx 安装与配置](https://ubuntu.com/server/docs/how-to/web-services/install-nginx/)：发行版安装和 systemd 管理。

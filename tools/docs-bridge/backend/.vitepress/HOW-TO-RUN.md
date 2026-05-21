# 内嵌文档中心(VitePress)

跨仓引用后端 `../file-batch-system/docs/` 的 169 篇 markdown,build 成静态站托管在 `/docs/`。

## 本地

```bash
npm run docs:dev      # http://localhost:5174/docs/
npm run docs:build    # 产物 → docs-site/.vitepress/dist/
npm run docs:preview  # 本地预览 build 产物
```

约束:`batch-console` 与 `file-batch-system` 必须在同一父目录(AGENTS.md 既有约束)。

## 部署

把 `docs-site/.vitepress/dist/` rsync 到 nginx 静态目录(如 `/var/www/batch-docs/`),然后:

```nginx
# 控制台 SPA
location / {
    root /var/www/batch-console;
    try_files $uri $uri/ /index.html;
}

# 后端 API
location /api/ {
    proxy_pass http://console-api:18080;
}

# 文档中心(P0 不做鉴权,P2 启用 auth_request)
location /docs/ {
    alias /var/www/batch-docs/;
    try_files $uri $uri/ $uri.html =404;

    # P2 启用:auth_request /__auth_check;
    # error_page 401 = @redirect_to_login;
}

# P2 阶段开启:鉴权探针
# location = /__auth_check {
#     internal;
#     proxy_pass http://console-api:18080/api/console/auth/check;
#     proxy_pass_request_body off;
#     proxy_set_header Content-Length "";
#     proxy_set_header X-Original-URI $request_uri;
# }
# location @redirect_to_login {
#     return 302 /login?redirect=$request_uri;
# }
```

## 设计文档

`../docs/design/内嵌文档中心方案.md`

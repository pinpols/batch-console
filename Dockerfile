# syntax=docker/dockerfile:1.7
# 多阶段:Node.js 24 LTS 构建 dist → Nginx stable Alpine 部署。
# 镜像最终 ~50MB(nginx alpine + dist),不含 node_modules。

# ───── Stage 1: build ─────
FROM node:24.21.0-alpine3.24@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS build
ENV LANG=C.UTF-8 \
    LC_ALL=C.UTF-8
WORKDIR /app

# 文档构建脚本复用仓库内 Bash 工具链；构建镜像必须显式提供运行时。
RUN apk add --no-cache bash

# 先拷依赖文件单独 COPY 以最大化 layer cache,只有 package*.json 变才重装
# .npmrc 必须一起拷:内含 legacy-peer-deps=true，否则 npm ci 会因 TS6 与
# @typescript-eslint/openapi-typescript 的 peer 声明冲突而 ERESOLVE 失败。
COPY package.json package-lock.json* .npmrc ./
COPY scripts/prepare.mjs ./scripts/prepare.mjs

# 默认 npm ci(干净安装,严格按 lock);CI 上可用 --omit=optional 进一步压
RUN npm ci --no-audit --no-fund --prefer-offline

# 拷源码并构建
COPY . .

# build:fast = vite build 不跑 vue-tsc(CI 已跑过 typecheck),节省 ~20s 构建时间
# 想严格类型检查的把这里改成 npm run build
ARG BUILD_MODE=build
ARG VITE_GIT_SHA=local
ARG SOURCE_DATE_EPOCH
ARG VITE_SENTRY_DSN=
ARG VITE_TELEMETRY_ENABLED=false
ARG VITE_TELEMETRY_ENDPOINT=/api/console/telemetry/events
ENV VITE_GIT_SHA=$VITE_GIT_SHA
ENV SOURCE_DATE_EPOCH=$SOURCE_DATE_EPOCH
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
ENV VITE_TELEMETRY_ENABLED=$VITE_TELEMETRY_ENABLED
ENV VITE_TELEMETRY_ENDPOINT=$VITE_TELEMETRY_ENDPOINT
RUN npm run ${BUILD_MODE}

# 后端文档通过 BuildKit named context 只读注入；与本仓 docs/ 构建为一个站点。
COPY --from=backend-docs . /file-batch-system/docs
RUN test -f /file-batch-system/docs/README.md && \
    FRONTEND_DOCS_ROOT=/app/docs BACKEND_DOCS_ROOT=/file-batch-system/docs npm run docs:build

# ───── Stage 2: runtime ─────
FROM nginx:1.30.5-alpine3.24@sha256:0985e772fb9f729e6fa0980da05fca5d9c468e870eed43071545afa9d2e27d94 AS runtime
ENV LANG=C.UTF-8 \
    LC_ALL=C.UTF-8

# 安装 healthcheck 和时区所需工具；基础镜像使用明确的 Nginx/Alpine 版本。
RUN apk add --no-cache curl tzdata && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone && \
    apk del tzdata

# 删默认配置,用我们自己的
RUN rm -rf /etc/nginx/conf.d/default.conf /usr/share/nginx/html/*

# 官方 entrypoint 需要写 conf.d，Nginx 还需要可写的临时目录。
# 静态文件和配置模板保留 root 所有权，只给运行用户读取权限。
RUN addgroup -S -g 10001 batch \
    && adduser -S -D -H -u 10001 -G batch batch \
    && chown batch:batch /etc/nginx/conf.d /var/cache/nginx

COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/snippets /etc/nginx/snippets
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template

COPY --from=build /app/dist /usr/share/nginx/html
# 单站文档产物 → /docs/
COPY --from=build /app/tools/docs-bridge/frontend/.vitepress/dist /var/www/batch-docs

# 默认 BE 上游(可在 docker run/compose 中覆盖)
ENV BACKEND_UPSTREAM_HOST=backend:18080 \
    NGINX_PORT=8080

USER batch:batch

EXPOSE 8080

# 健康检查:5s 内返 200 即活着
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fs http://127.0.0.1:${NGINX_PORT}/healthz || exit 1

# nginx 1.19+ 自带 envsubst on 启动 entry,会读 /etc/nginx/templates/*.template
# 输出到 /etc/nginx/conf.d/*.conf,把 ${BACKEND_UPSTREAM} / ${NGINX_PORT} 替换掉
CMD ["nginx", "-g", "daemon off;"]

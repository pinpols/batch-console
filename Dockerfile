# syntax=docker/dockerfile:1.7
# 多阶段:node 构建 dist → nginx 1.27 alpine 部署。
# 镜像最终 ~50MB(nginx alpine + dist),不含 node_modules。

# ───── Stage 1: build ─────
FROM node:22-alpine AS build
WORKDIR /app

# 先拷依赖文件单独 COPY 以最大化 layer cache,只有 package*.json 变才重装
COPY package.json package-lock.json* ./
COPY scripts/prepare.mjs ./scripts/prepare.mjs

# 默认 npm ci(干净安装,严格按 lock);CI 上可用 --omit=optional 进一步压
RUN npm ci --no-audit --no-fund --prefer-offline

# 拷源码并构建
COPY . .

# build:fast = vite build 不跑 vue-tsc(CI 已跑过 typecheck),节省 ~20s 构建时间
# 想严格类型检查的把这里改成 npm run build
ARG BUILD_MODE=build:fast
RUN npm run ${BUILD_MODE}

# ── 文档站点(可选):跨仓 srcDir = ../../file-batch-system/docs ──
# vitepress 配置:docs-site/.vitepress/config.ts(base: /docs/)
# 仅当 build context 包含 file-batch-system/docs(用 docker build -f Dockerfile ../)
# 才能成功构建;否则回退占位页,nginx /docs/ 路径也不会 404 整面崩溃。
RUN if [ -d /app/../file-batch-system/docs ] || [ -d ../file-batch-system/docs ]; then \
      echo "[docs] building vitepress from sibling repo..." && \
      npm run docs:build; \
    else \
      echo "[docs] sibling docs repo not in build context — fallback placeholder" && \
      mkdir -p docs-site/.vitepress/dist && \
      printf '<!doctype html><meta charset=utf-8><title>docs</title><h1>文档暂未构建</h1><p>请在 docker build 时把 build context 扩展到父目录,或预先 <code>npm run docs:build</code></p>' \
        > docs-site/.vitepress/dist/index.html; \
    fi

# ───── Stage 2: runtime ─────
FROM nginx:1.27-alpine AS runtime

# apk upgrade:升级 base image 默认的 libcrypto3 / libssl3 等(治 CVE-2026-31789 CRITICAL,
# nginx:1.27-alpine 镜像更新滞后,显式 upgrade 拿 alpine 仓库 latest patch);
# 然后装 curl 方便 healthcheck / 排查
RUN apk upgrade --no-cache && \
    apk add --no-cache curl tzdata && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone && \
    apk del tzdata

# 删默认配置,用我们自己的
RUN rm -rf /etc/nginx/conf.d/default.conf /usr/share/nginx/html/*

COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template

COPY --from=build /app/dist /usr/share/nginx/html
# 文档站点(若上一阶段构建成功)→ /var/www/batch-docs,nginx /docs/ alias 指过去
COPY --from=build /app/docs-site/.vitepress/dist /var/www/batch-docs

# 默认 BE 上游(可在 docker run/compose 中覆盖)
ENV BACKEND_UPSTREAM_HOST=backend:18080 \
    NGINX_PORT=80

EXPOSE 80

# 健康检查:5s 内返 200 即活着
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fs http://localhost:${NGINX_PORT}/healthz || exit 1

# nginx 1.19+ 自带 envsubst on 启动 entry,会读 /etc/nginx/templates/*.template
# 输出到 /etc/nginx/conf.d/*.conf,把 ${BACKEND_UPSTREAM} / ${NGINX_PORT} 替换掉
CMD ["nginx", "-g", "daemon off;"]

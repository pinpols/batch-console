#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
EXPECTED_VERSION="${1:-${RELEASE_VERSION:-}}"

PACKAGE_VERSION="$(node -p "require('$ROOT_DIR/package.json').version")"
LOCK_VERSION="$(node -p "require('$ROOT_DIR/package-lock.json').version")"
LOCK_ROOT_VERSION="$(node -p "require('$ROOT_DIR/package-lock.json').packages[''].version")"

if [[ "$PACKAGE_VERSION" != "$LOCK_VERSION" ]] \
  || [[ "$PACKAGE_VERSION" != "$LOCK_ROOT_VERSION" ]]; then
  echo "版本不一致: package.json=$PACKAGE_VERSION package-lock.json=$LOCK_VERSION packages['']=$LOCK_ROOT_VERSION" >&2
  exit 1
fi

if [[ -n "$EXPECTED_VERSION" && "$PACKAGE_VERSION" != "$EXPECTED_VERSION" ]]; then
  echo "前端版本 $PACKAGE_VERSION 与期望发布版本 $EXPECTED_VERSION 不一致" >&2
  exit 1
fi

NODE_BASE_IMAGE="$(sed -nE 's/^FROM (node:[^ ]+) AS build$/\1/p' "$ROOT_DIR/Dockerfile")"
NGINX_BASE_IMAGE="$(sed -nE 's/^FROM (nginx:[^ ]+) AS runtime$/\1/p' "$ROOT_DIR/Dockerfile")"
if [[ ! "$NODE_BASE_IMAGE" =~ ^node:[0-9]+\.[0-9]+\.[0-9]+-alpine[0-9]+\.[0-9]+$ ]]; then
  echo "Node 构建镜像必须使用精确版本和 Alpine 次版本，实际: ${NODE_BASE_IMAGE:-missing}" >&2
  exit 1
fi
if [[ ! "$NGINX_BASE_IMAGE" =~ ^nginx:[0-9]+\.[0-9]+\.[0-9]+-alpine[0-9]+\.[0-9]+$ ]]; then
  echo "Nginx 运行镜像必须使用精确版本和 Alpine 次版本，实际: ${NGINX_BASE_IMAGE:-missing}" >&2
  exit 1
fi
if grep -En -- 'image:.*(:latest|\$\{IMAGE_TAG:-latest\})' "$ROOT_DIR/docker-compose.deploy.yml"; then
  echo "生产部署 Compose 不得引用 latest" >&2
  exit 1
fi
if ! grep -Fq -- '${IMAGE_TAG:?' "$ROOT_DIR/docker-compose.deploy.yml"; then
  echo "生产部署 Compose 必须显式设置 IMAGE_TAG" >&2
  exit 1
fi

echo "版本对齐: batch-console=$PACKAGE_VERSION; node=$NODE_BASE_IMAGE; nginx=$NGINX_BASE_IMAGE; deploy IMAGE_TAG required"

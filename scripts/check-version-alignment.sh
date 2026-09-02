#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
EXPECTED_VERSION="${1:-${RELEASE_VERSION:-}}"

PACKAGE_VERSION="$(node -p "require('$ROOT_DIR/package.json').version")"
LOCK_VERSION="$(node -p "require('$ROOT_DIR/package-lock.json').version")"
LOCK_ROOT_VERSION="$(node -p "require('$ROOT_DIR/package-lock.json').packages[''].version")"

if [[ "$PACKAGE_VERSION" != "$LOCK_VERSION" || "$PACKAGE_VERSION" != "$LOCK_ROOT_VERSION" ]]; then
  echo "版本不一致: package.json=$PACKAGE_VERSION package-lock.json=$LOCK_VERSION packages['']=$LOCK_ROOT_VERSION" >&2
  exit 1
fi

if [[ -n "$EXPECTED_VERSION" && "$PACKAGE_VERSION" != "$EXPECTED_VERSION" ]]; then
  echo "前端版本 $PACKAGE_VERSION 与期望发布版本 $EXPECTED_VERSION 不一致" >&2
  exit 1
fi

echo "版本对齐: batch-console=$PACKAGE_VERSION"

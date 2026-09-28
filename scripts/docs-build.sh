#!/usr/bin/env bash
# =========================================================
# docs-build.sh — 构建前后端统一 VitePress 站点
#
# 用法:
#   scripts/docs-build.sh                 # 前后端文档只构建一次
#   BACKEND_DOCS_ROOT=/path/to/docs scripts/docs-build.sh
#
# 注:聚合源目录为构建产物，本地使用 build → preview。
# =========================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/docs-lib.sh
source "$SCRIPT_DIR/docs-lib.sh"
cd "$DOCS_ROOT_DIR"

if [[ $# -ne 0 ]]; then
  echo "ERROR: docs-build.sh 不接受站点参数；请直接运行 npm run docs:build" >&2
  exit 2
fi

NPM_BIN="${NPM:-npm}"
echo "▶ docs:prepare(只读汇入前后端文档)"
"$NPM_BIN" run docs:prepare
echo "▶ 构建文档:$DOCS_DIR"
"$DOCS_ROOT_DIR/node_modules/.bin/vitepress" build "$DOCS_DIR"
"$NPM_BIN" run docs:size
echo "✓ 统一文档站构建完成"

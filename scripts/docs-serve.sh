#!/usr/bin/env bash
# =========================================================
# docs-serve.sh — 启动统一文档站(kill 端口 → build → preview)
#
# 聚合源目录为构建产物，本地使用 build → preview。
#
# 用法:
#   scripts/docs-serve.sh                    # 统一文档站，端口 5174
#   DOCS_PORT=6174 scripts/docs-serve.sh     # 指定端口
#   NO_BUILD=1 scripts/docs-serve.sh         # 预览现有产物
# =========================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/docs-lib.sh
source "$SCRIPT_DIR/docs-lib.sh"
cd "$DOCS_ROOT_DIR"

if [[ $# -ne 0 ]]; then
  echo "ERROR: docs-serve.sh 不接受站点参数；请使用 DOCS_PORT 覆盖端口" >&2
  exit 2
fi

echo "▶ 文档启动:dir=$DOCS_DIR port=$DOCS_PORT"
kill_port "$DOCS_PORT"

if [[ "${NO_BUILD:-0}" != "1" ]]; then
  bash "$SCRIPT_DIR/docs-build.sh"
fi

echo "✓ 文档 preview → http://localhost:$DOCS_PORT/docs/"
if [[ -n "${DOCS_LOG:-}" ]]; then
  exec "$DOCS_ROOT_DIR/node_modules/.bin/vitepress" preview "$DOCS_DIR" --host 127.0.0.1 --port "$DOCS_PORT" 2>&1 | tee -a "$DOCS_LOG"
else
  exec "$DOCS_ROOT_DIR/node_modules/.bin/vitepress" preview "$DOCS_DIR" --host 127.0.0.1 --port "$DOCS_PORT"
fi

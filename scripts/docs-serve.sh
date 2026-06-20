#!/usr/bin/env bash
# =========================================================
# docs-serve.sh — 启动 vitepress 文档(kill 端口 → build → preview)
#
# vitepress 跨仓 dev 模式 404(见 package.json),文档统一 build → preview。
#
# 用法:
#   scripts/docs-serve.sh backend            # tools/docs-bridge/backend，端口 5174
#   scripts/docs-serve.sh frontend           # tools/docs-bridge/frontend，端口 5175
#   scripts/docs-serve.sh backend 6174        # 指定端口
#   scripts/docs-serve.sh tools/docs-bridge/backend 5174   # 直接传目录
#   NO_BUILD=1 scripts/docs-serve.sh backend  # 跳过 build,直接 preview 已有产物
#   DOCS_LOG=path scripts/docs-serve.sh backend  # 把输出 tee 到日志文件
# =========================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/docs-lib.sh
source "$SCRIPT_DIR/docs-lib.sh"
cd "$DOCS_ROOT_DIR"

resolve_docs_target "${1:?用法: docs-serve.sh <backend|frontend|目录> [端口]}" "${2:-}"

echo "▶ 文档启动:dir=$DOCS_DIR port=$DOCS_PORT"
kill_port "$DOCS_PORT"

if [[ "${NO_BUILD:-0}" != "1" ]]; then
  bash "$SCRIPT_DIR/docs-build.sh" "$1"
fi

echo "✓ 文档 preview → http://localhost:$DOCS_PORT/"
if [[ -n "${DOCS_LOG:-}" ]]; then
  exec npx vitepress preview "$DOCS_DIR" --port "$DOCS_PORT" 2>&1 | tee -a "$DOCS_LOG"
else
  exec npx vitepress preview "$DOCS_DIR" --port "$DOCS_PORT"
fi

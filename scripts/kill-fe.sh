#!/usr/bin/env bash
# =========================================================
# kill-fe.sh — kill 所有前端 dev 服务(SPA + 文档 + preview 各端口)
# 用法:scripts/kill-fe.sh [端口...]   不传则用默认全集
# =========================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/docs-lib.sh
source "$SCRIPT_DIR/docs-lib.sh"

# 默认:SPA 5173 / BE 文档 5174 / FE 文档 5175 / 备用 5176 / vite preview 4173
PORTS=("${@:-}")
[[ -z "${PORTS[*]}" ]] && PORTS=(5173 5174 5175 5176 4173)

# 先停后台 stack(concurrently -k 会连带 kill 子进程),再按端口兜底
for pidf in "$DOCS_ROOT_DIR/.dev-stack.pid" "$DOCS_ROOT_DIR/.vite-dev.pid"; do
  if [[ -f "$pidf" ]]; then
    pid="$(cat "$pidf" 2>/dev/null || true)"
    [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null && { echo "  停后台进程 PID $pid($(basename "$pidf"))"; kill "$pid" 2>/dev/null || true; }
    rm -f "$pidf" 2>/dev/null || true
  fi
done

echo "▶ kill 前端 dev 端口:${PORTS[*]}"
for p in "${PORTS[@]}"; do kill_port "$p"; done
echo "✅ 前端 dev 服务已全部清理"

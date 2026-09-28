#!/usr/bin/env bash
# =========================================================
# docs-lib.sh — 统一文档站路径与端口清理
# 被 docs-build.sh / docs-serve.sh / dev-server.sh source。
# =========================================================
set -euo pipefail

DOCS_ROOT_DIR="${DOCS_ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
DOCS_BRIDGE_DIR="$DOCS_ROOT_DIR/tools/docs-bridge"
DOCS_DIR="$DOCS_BRIDGE_DIR/frontend"
DOCS_PORT="${DOCS_PORT:-5174}"
export DOCS_DIR DOCS_PORT

# 仅停止本仓 Vite/VitePress 进程；未知端口占用者直接报错。
kill_port() {
  local port="${1:?需要端口}"
  local pids
  pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
  [[ -z "$pids" ]] && return 0
  local pid command_line
  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    command_line="$(ps -p "$pid" -o command= 2>/dev/null || true)"
    if [[ "$command_line" == *vitepress* && "$command_line" == *"$DOCS_BRIDGE_DIR"* ]]; then
      :
    elif [[ "$command_line" == *"$DOCS_ROOT_DIR/node_modules/.bin/vite "* ]]; then
      :
    else
      echo "ERROR: 端口 :$port 被未知进程占用，拒绝自动终止。" >&2
      echo "  pid=$pid command=${command_line:-<unavailable>}" >&2
      return 1
    fi
    echo "  停止本仓开发服务 :$port(pid=$pid)"
    kill -TERM "$pid" 2>/dev/null || true
    local waited=0
    while kill -0 "$pid" 2>/dev/null && (( waited < 10 )); do
      sleep 1
      waited=$((waited + 1))
    done
    if kill -0 "$pid" 2>/dev/null; then
      if [[ "${FORCE_KILL:-0}" != "1" ]]; then
        echo "ERROR: pid=$pid 在 10s 内未退出；确认后可用 FORCE_KILL=1 重试。" >&2
        return 1
      fi
      kill -9 "$pid" 2>/dev/null || true
    fi
  done <<<"$pids"
  return 0
}

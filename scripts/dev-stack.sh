#!/usr/bin/env bash
# =========================================================
# dev-stack.sh — 构建文档后由 SPA Vite 同进程提供 /docs/
#
# 用法:scripts/dev-stack.sh
#   Vite 同进程提供文档，Ctrl-C 停止当前开发服务。
# env:DEV_HOST(默认 0.0.0.0)、SPA_PORT(默认 5173)
# =========================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/docs-lib.sh
source "$SCRIPT_DIR/docs-lib.sh"
cd "$DOCS_ROOT_DIR"

DEV_HOST="${DEV_HOST:-0.0.0.0}"
SPA_PORT="${SPA_PORT:-5173}"
NPM_BIN="${NPM:-npm}"

# 1) 只接管本仓进程占用的端口
kill_port "$SPA_PORT"

# 2) 构建聚合文档，供 Vite 同源服务使用
bash "$SCRIPT_DIR/docs-build.sh"

STACK_LOG="${STACK_LOG:-$DOCS_ROOT_DIR/.dev-stack.log}"
STACK_PID="${STACK_PID:-$DOCS_ROOT_DIR/.dev-stack.pid}"

if [[ "${BG:-0}" == "1" ]]; then
  if [[ -f "$STACK_PID" ]] && kill -0 "$(cat "$STACK_PID")" 2>/dev/null; then
    echo "✗ dev-stack 已在后台运行(PID $(cat "$STACK_PID"));先 make kill 再起" >&2
    exit 1
  fi
  # 长时间联调时避免单个后台日志无限增长。保留最近一份旧日志，默认 50 MiB。
  max_log_bytes="${STACK_LOG_MAX_BYTES:-52428800}"
  if [[ -f "$STACK_LOG" ]] && [[ "$(wc -c < "$STACK_LOG")" -gt "$max_log_bytes" ]]; then
    mv -f "$STACK_LOG" "$STACK_LOG.1"
  fi
  echo "▶ 后台启动:SPA :$SPA_PORT + 文档 /docs/ → 日志 $STACK_LOG"
  nohup "$NPM_BIN" run dev -- --host "$DEV_HOST" --port "$SPA_PORT" > "$STACK_LOG" 2>&1 &
  echo $! > "$STACK_PID"
  echo "  PID $(cat "$STACK_PID")  ·  tail: make logs-stack  ·  停: make kill"
else
  echo "▶ SPA http://localhost:$SPA_PORT/ + 文档 http://localhost:$SPA_PORT/docs/"
  exec "$NPM_BIN" run dev -- --host "$DEV_HOST" --port "$SPA_PORT"
fi

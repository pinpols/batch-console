#!/usr/bin/env bash
# =========================================================
# dev-stack.sh — SPA + 单站文档一起起(kill 对应端口 → build → concurrently)
#
# 用法:scripts/dev-stack.sh
#   concurrently -k:任一退出/Ctrl-C 时连带 kill 全部,不留残留 preview。
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
kill_port "$DOCS_PORT"

# 2) 先 build 聚合文档(preview 需产物)
bash "$SCRIPT_DIR/docs-build.sh"

# 3) concurrently 跑 SPA + 单个文档 preview(-k 连带退出)。
SPA_CMD="$NPM_BIN run dev -- --host $DEV_HOST --port $SPA_PORT"
set -- -k -n SPA,DOCS -c blue,green \
  "$SPA_CMD" \
  "NO_BUILD=1 bash $SCRIPT_DIR/docs-serve.sh"

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
  nohup npx concurrently "$@" > "$STACK_LOG" 2>&1 &
  echo $! > "$STACK_PID"
  echo "  PID $(cat "$STACK_PID")  ·  tail: make logs-stack  ·  停: make kill"
else
  echo "▶ SPA http://localhost:$SPA_PORT/ + 文档 http://localhost:$SPA_PORT/docs/"
  exec npx concurrently "$@"
fi

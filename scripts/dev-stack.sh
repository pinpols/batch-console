#!/usr/bin/env bash
# =========================================================
# dev-stack.sh — SPA + 文档栈一起起(kill 对应端口 → build 文档 → concurrently 前台)
#
# 用法:scripts/dev-stack.sh [all|backend|frontend]   默认 all
#   concurrently -k:任一退出/Ctrl-C 时连带 kill 全部,不留残留 preview。
# env:DEV_HOST(默认 0.0.0.0)、SPA_PORT(默认 5173)
# =========================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/docs-lib.sh
source "$SCRIPT_DIR/docs-lib.sh"
cd "$DOCS_ROOT_DIR"

DOCS="${1:-all}"
DEV_HOST="${DEV_HOST:-0.0.0.0}"
SPA_PORT="${SPA_PORT:-5173}"
NPM_BIN="${NPM:-npm}"

# 1) kill 对应端口(SPA + 选中的文档目标)
kill_port "$SPA_PORT"
for t in $(expand_docs_targets "$DOCS"); do
  resolve_docs_target "$t"; kill_port "$DOCS_PORT"
done

# 2) 先 build 文档(preview 需产物;dev 模式 vitepress 跨仓 404)
bash "$SCRIPT_DIR/docs-build.sh" "$DOCS"

# 3) concurrently 跑 SPA + 文档 preview(-k 连带退出)。BG=1 → 后台 + 写日志。
SPA_CMD="$NPM_BIN run dev -- --host $DEV_HOST --port $SPA_PORT"
if [[ "$DOCS" == "all" ]]; then
  set -- -k -n SPA,BE-DOCS,FE-DOCS -c blue,green,magenta \
    "$SPA_CMD" \
    "NO_BUILD=1 bash $SCRIPT_DIR/docs-serve.sh backend" \
    "NO_BUILD=1 bash $SCRIPT_DIR/docs-serve.sh frontend"
else
  set -- -k -n SPA,DOCS -c blue,green \
    "$SPA_CMD" \
    "NO_BUILD=1 bash $SCRIPT_DIR/docs-serve.sh $DOCS"
fi

STACK_LOG="${STACK_LOG:-$DOCS_ROOT_DIR/.dev-stack.log}"
STACK_PID="${STACK_PID:-$DOCS_ROOT_DIR/.dev-stack.pid}"

if [[ "${BG:-0}" == "1" ]]; then
  if [[ -f "$STACK_PID" ]] && kill -0 "$(cat "$STACK_PID")" 2>/dev/null; then
    echo "✗ dev-stack 已在后台运行(PID $(cat "$STACK_PID"));先 make kill 再起" >&2
    exit 1
  fi
  echo "▶ 后台启动 stack[$DOCS]:SPA :$SPA_PORT + 文档 → 日志 $STACK_LOG"
  nohup npx concurrently "$@" > "$STACK_LOG" 2>&1 &
  echo $! > "$STACK_PID"
  echo "  PID $(cat "$STACK_PID")  ·  tail: make logs-stack  ·  停: make kill"
else
  echo "▶ SPA http://localhost:$SPA_PORT/  +  文档栈[$DOCS](前台,Ctrl+C 一起停)"
  exec npx concurrently "$@"
fi

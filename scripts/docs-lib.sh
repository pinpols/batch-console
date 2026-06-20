#!/usr/bin/env bash
# =========================================================
# docs-lib.sh — 文档脚本共享:目标(backend/frontend/路径)解析 + 端口清理
# 被 docs-build.sh / docs-serve.sh / dev-server.sh source。
# =========================================================
set -euo pipefail

DOCS_ROOT_DIR="${DOCS_ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
DOCS_BRIDGE_DIR="$DOCS_ROOT_DIR/tools/docs-bridge"

# 目标别名 → 文档目录(vitepress srcDir)+ 默认 preview 端口。
# 也接受直接传一个目录路径(此时端口走第 2 参 / DOCS_PORT,缺省 5174)。
# 用法:resolve_docs_target <backend|frontend|路径> [端口覆盖]
#   解析后导出 DOCS_DIR / DOCS_PORT / DOCS_NEEDS_PREPARE
resolve_docs_target() {
  local target="${1:?需要文档目标:backend|frontend|<目录路径>}"
  local port_override="${2:-}"

  case "$target" in
    backend|be)
      DOCS_DIR="$DOCS_BRIDGE_DIR/backend"
      DOCS_PORT="5174"
      DOCS_NEEDS_PREPARE="1" # backend 桥接 sibling file-batch-system/docs,需 docs:prepare
      ;;
    frontend|fe)
      DOCS_DIR="$DOCS_BRIDGE_DIR/frontend"
      DOCS_PORT="5175"
      DOCS_NEEDS_PREPARE="0"
      ;;
    *)
      # 直接传目录路径:相对则相对 repo root
      if [[ "$target" = /* ]]; then DOCS_DIR="$target"; else DOCS_DIR="$DOCS_ROOT_DIR/$target"; fi
      DOCS_PORT="${port_override:-${DOCS_PORT:-5174}}"
      DOCS_NEEDS_PREPARE="0"
      ;;
  esac
  [[ -n "$port_override" ]] && DOCS_PORT="$port_override"
  DOCS_PORT="${DOCS_PORT:-5174}"

  if [[ ! -d "$DOCS_DIR/.vitepress" ]]; then
    echo "✗ 文档目录无效(缺 .vitepress):$DOCS_DIR" >&2
    return 1
  fi
  export DOCS_DIR DOCS_PORT DOCS_NEEDS_PREPARE
}

# 跨仓 srcDir(file-batch-system/docs)编出的 .md import 'vue',Rollup 从 docs-bridge 旁
# 找不到本仓 node_modules → ENOENT。建一个指向仓根 node_modules 的符号链接(gitignored,
# 幂等)让 vue 可达。配合各 config.ts 的 dedupe/v-pre,docs build 才能跑。
ensure_docs_node_modules() {
  local link="$DOCS_BRIDGE_DIR/node_modules"
  [[ -e "$link" ]] && return 0
  ln -sfn ../../node_modules "$link" 2>/dev/null \
    && echo "  建符号链接 tools/docs-bridge/node_modules → ../../node_modules" \
    || echo "  ⚠ 无法建 docs-bridge/node_modules 符号链接(vue 解析可能失败)" >&2
}

# 展开 "all" → backend frontend;其余原样返回(供 build/serve 遍历)
expand_docs_targets() {
  local t="${1:-all}"
  case "$t" in
    all) echo "backend frontend" ;;
    *)   echo "$t" ;;
  esac
}

# 杀掉占用指定端口的进程(优雅 → 强制)
kill_port() {
  local port="${1:?需要端口}"
  local pids
  pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
  [[ -z "$pids" ]] && return 0
  echo "  释放端口 :$port(kill $(echo "$pids" | tr '\n' ' '))"
  echo "$pids" | xargs -r kill 2>/dev/null || true
  sleep 1
  pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
  [[ -n "$pids" ]] && { echo "  强制 kill -9 :$port"; echo "$pids" | xargs -r kill -9 2>/dev/null || true; }
  return 0
}

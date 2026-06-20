#!/usr/bin/env bash
# =========================================================
# docs-build.sh — 构建 vitepress 文档(目录参数化)
#
# 用法:
#   scripts/docs-build.sh                 # 默认 all(backend + frontend)
#   scripts/docs-build.sh backend         # 只构建 BE 文档(tools/docs-bridge/backend)
#   scripts/docs-build.sh frontend        # 只构建 FE 文档
#   scripts/docs-build.sh all
#   scripts/docs-build.sh tools/docs-bridge/backend   # 直接传目录路径
#
# 注:vitepress 跨仓 dev 模式 404(见 package.json 注释),文档统一 build → preview。
# =========================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/docs-lib.sh
source "$SCRIPT_DIR/docs-lib.sh"
cd "$DOCS_ROOT_DIR"

NPM_BIN="${NPM:-npm}"
prepared=0

build_one() {
  local target="$1"
  resolve_docs_target "$target"
  if [[ "$DOCS_NEEDS_PREPARE" == "1" && "$prepared" == "0" ]]; then
    echo "▶ docs:prepare(清理 BE docs 残留软链)"
    "$NPM_BIN" run docs:prepare
    prepared=1
  fi
  echo "▶ 构建文档:$DOCS_DIR"
  npx vitepress build "$DOCS_DIR"
  echo "✓ 构建完成:$DOCS_DIR"
}

main() {
  ensure_docs_node_modules
  local targets
  targets="$(expand_docs_targets "${1:-all}")"
  for t in $targets; do build_one "$t"; done
  echo "✅ 文档构建全部完成:${1:-all}"
}

main "$@"

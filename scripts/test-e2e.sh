#!/usr/bin/env bash
# 用途：运行 Playwright E2E。
# 用法：bash scripts/test-e2e.sh。

set -euo pipefail

ACTION="${1:-run}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NPM_BIN="${NPM:-npm}"

cd "$ROOT_DIR"

case "$ACTION" in
  run)
    exec "$NPM_BIN" run test:e2e
    ;;
  all)
    exec "$NPM_BIN" run test:e2e:all
    ;;
  ui)
    exec "$NPM_BIN" run test:e2e:ui
    ;;
  headed)
    exec "$NPM_BIN" run test:e2e:headed
    ;;
  *)
    echo "Usage: scripts/test-e2e.sh {run|all|ui|headed}"
    exit 1
    ;;
esac

#!/bin/zsh

set -euo pipefail

ACTION="${1:-run}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NPM_BIN="${NPM:-npm}"

cd "$ROOT_DIR"

case "$ACTION" in
  run)
    exec "$NPM_BIN" run test:unit
    ;;
  watch)
    exec "$NPM_BIN" run test:unit:watch
    ;;
  *)
    echo "Usage: scripts/test-unit.sh {run|watch}"
    exit 1
    ;;
esac

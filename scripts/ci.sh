#!/bin/zsh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NPM_BIN="${NPM:-npm}"
LINT_SCRIPT="${LINT_SCRIPT:-$NPM_BIN run lint}"
BUILD_SCRIPT="${BUILD_SCRIPT:-$NPM_BIN run build}"
UNIT_SCRIPT="${UNIT_SCRIPT:-$ROOT_DIR/scripts/test-unit.sh run}"
E2E_SCRIPT="${E2E_SCRIPT:-$ROOT_DIR/scripts/test-e2e.sh run}"

cd "$ROOT_DIR"

echo "Running lint"
eval "$LINT_SCRIPT"

echo "Running build"
eval "$BUILD_SCRIPT"

echo "Running unit tests"
eval "$UNIT_SCRIPT"

echo "Running e2e tests"
eval "$E2E_SCRIPT"

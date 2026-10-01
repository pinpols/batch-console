#!/usr/bin/env bash
# 本地无后端门禁：与 PR 静态检查保持同一口径，不修改工作区，也不伪装真实环境验收。
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# shellcheck source=lib/gate-result.sh
source "$ROOT_DIR/scripts/lib/gate-result.sh"
export BATCH_GATE_COLLECT=1
export BATCH_GATE_FAILURE_FILE="${TMPDIR:-/tmp}/batch-console-local-gate-$$.tsv"
trap 'rm -f "$BATCH_GATE_FAILURE_FILE"' EXIT
gate_reset_collected

gate_run FE_VERSION "版本对齐" npm run check:version
gate_run FE_LINT "ESLint" npm run lint:check
gate_run FE_TYPECHECK "TypeScript 类型检查" npm run typecheck
gate_run FE_I18N "国际化词条一致性" npm run check:i18n
gate_run FE_API_DRIFT "OpenAPI 漂移" npm run gen:api:check
bash scripts/verify-governance.sh
gate_run FE_UNIT "Vitest 单测与覆盖率" npm run test:unit -- --coverage
gate_run FE_BUILD "Vite 生产构建" npm run build:fast
gate_run FE_BUNDLE_SIZE "Bundle 体积预算" npm run size
gate_run FE_NPM_AUDIT "生产依赖漏洞审计" npm audit --omit=dev --audit-level=high
gate_assert_collected

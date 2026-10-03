#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
cd "$ROOT"
# shellcheck source=lib/gate-result.sh
source "$ROOT/scripts/lib/gate-result.sh"

owns_collection=0
if [[ "${BATCH_GATE_COLLECT:-0}" != "1" ]]; then
  export BATCH_GATE_COLLECT=1
  export BATCH_GATE_FAILURE_FILE="${TMPDIR:-/tmp}/batch-console-governance-$$.tsv"
  gate_reset_collected
  trap 'rm -f "$BATCH_GATE_FAILURE_FILE"' EXIT
  owns_collection=1
fi

gate_run FE_ENCODING "UTF-8 编码" npm run check:encoding
gate_run FE_COMMENTS "中文解释性注释" npm run check:comments
gate_run FE_ARCHITECTURE "架构边界" npm run check:architecture
gate_run FE_ENV "环境变量治理" npm run check:env
gate_run FE_MAINTAINABILITY "可维护性" npm run check:maintainability
gate_run FE_UI_COMPLEXITY "UI 复杂度预算" npm run check:ui-complexity
gate_run FE_WORKFLOWS "Workflow 治理" npm run check:workflows
gate_run FE_SHELL "Shell 治理" npm run check:shell
gate_run FE_DOCS "文档治理" npm run check:docs
gate_run FE_GO_LIVE_READINESS "上线准入文档治理" npm run check:go-live-readiness
gate_run FE_COMPLIANCE "SBOM 与许可证" npm run compliance:check
gate_run FE_CHANGELOG "Changelog 同步" npm run check:changelog

if ((owns_collection == 1)); then
  gate_assert_collected
fi

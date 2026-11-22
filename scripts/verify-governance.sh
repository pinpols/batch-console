#!/usr/bin/env bash
# 用途：本地治理门禁总入口。
# 用法：bash scripts/verify-governance.sh。
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
cd "$ROOT"
# shellcheck source=lib/gate-result.sh
source "$ROOT/scripts/lib/gate-result.sh"
export BATCH_GATE_GROUP=governance

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
gate_run FE_READABILITY_CALLS "新增调用现场深层嵌套" npm run check:readability-calls
gate_run FE_READABILITY_CALLS_TEST "调用现场门禁正反例" npm run test:readability-calls
gate_run FE_BASELINE_EXPANSION "治理基线扩张审批与反例" bash -c 'npm run check:baseline-expansion && npm run test:baseline-expansion'
BATCH_GATE_GROUP=testing gate_run FE_TEST_FIXTURE_SOURCES "测试 fixture 事实来源" npm run check:test-fixture-sources
BATCH_GATE_GROUP=testing gate_run FE_TYPECHECK_SCOPE_TEST "类型检查源码范围正反例" npm run test:typecheck
BATCH_GATE_GROUP=testing gate_run FE_TEST_REPORT_SUMMARY_TEST "测试报告汇总正反例" node --test scripts/tests/test-report-summary.test.mjs
gate_run FE_UI_COMPLEXITY "UI 复杂度预算" npm run check:ui-complexity
gate_run FE_WORKFLOWS "Workflow 治理" npm run check:workflows
gate_run FE_SHELL "Shell 治理" npm run check:shell
gate_run FE_SHELL_PORTABILITY "Shell 跨平台兼容性" npm run check:shell:portability
BATCH_GATE_GROUP=testing gate_run FE_SHELL_PORTABILITY_TEST "Shell 兼容门禁正反例" npm run test:shell-portability
gate_run FE_SCRIPT_METADATA "脚本头与索引" npm run check:script:metadata
gate_run FE_SCRIPT_METADATA_TEST "脚本头门禁正反例" npm run test:script-metadata
BATCH_GATE_GROUP=testing gate_run FE_GITLEAKS_SCAN_TEST "密钥扫描范围正反例" npm run test:gitleaks-scan
BATCH_GATE_GROUP=testing gate_run FE_TEST_QUARANTINE "测试隔离治理" npm run check:test:quarantine
BATCH_GATE_GROUP=testing gate_run FE_TEST_QUARANTINE_TEST "测试隔离门禁正反例" npm run test:test-quarantine
BATCH_GATE_GROUP=testing gate_run FE_DIFF_COVERAGE_TEST "增量覆盖率门禁正反例" npm run test:diff-coverage
BATCH_GATE_GROUP=testing gate_run FE_FLAKY_RESULTS_TEST "flaky 结果门禁正反例" npm run test:flaky-results
gate_run FE_DOCS "文档治理" npm run check:docs
gate_run FE_GO_LIVE_READINESS "上线准入文档治理" npm run check:go-live-readiness
gate_run FE_COMPLIANCE "SBOM 与许可证" npm run compliance:check
gate_run FE_CHANGELOG "Changelog 同步" npm run check:changelog

if ((owns_collection == 1)); then
  gate_assert_collected
fi

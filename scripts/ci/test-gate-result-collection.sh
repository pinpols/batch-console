#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
# shellcheck source=../lib/gate-result.sh
source "$ROOT/scripts/lib/gate-result.sh"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
export BATCH_GATE_COLLECT=1
export BATCH_GATE_FAILURE_FILE="$tmp_dir/failures.tsv"

gate_reset_collected
wrapper_output="$(bash "$ROOT/scripts/ci/run-gate.sh" --group localization TEST_WRAPPER "包装器分组" -- true)"
[[ "$wrapper_output" == "✅ 通过 | code=TEST_WRAPPER | gate=包装器分组 | group=localization | mode=enforce | exit_code=0 | action=none" ]]
report_output="$(bash "$ROOT/scripts/ci/run-gate.sh" --group quality --mode report TEST_REPORT "报告模式" -- bash -c 'exit 7' 2>&1)"
[[ "$report_output" == *"⚠️ 报告 | code=TEST_REPORT | gate=报告模式 | group=quality | mode=report | exit_code=7 | action=review_report"* ]]
legacy_output="$(bash "$ROOT/scripts/ci/run-gate.sh" --group quality TEST_LEGACY "旧状态格式" -- bash -c 'printf "详情保留\n✅ 通过 | code=OLD_CHILD | gate=旧状态\n✅ 通过 | code=NESTED | gate=嵌套门禁 | group=testing | mode=enforce | exit_code=0 | action=none\n"' 2>&1)"
[[ "$legacy_output" == *"详情保留"* && "$legacy_output" == *"code=NESTED | gate=嵌套门禁 | group=testing | mode=enforce"* ]]
[[ "$legacy_output" != *"OLD_CHILD"* ]]
ignore_marker="$tmp_dir/ignored-command-ran"
ignore_output="$(BATCH_GATE_GROUP_MODES='quality=ignore' bash "$ROOT/scripts/ci/run-gate.sh" --group quality TEST_IGNORE "忽略模式" -- touch "$ignore_marker")"
[[ "$ignore_output" == *"⏭️ 忽略 | code=TEST_IGNORE | gate=忽略模式 | group=quality | mode=ignore | exit_code=0 | action=none"* ]]
[[ ! -e "$ignore_marker" ]]
pass_output="$(gate_run TEST_PASS "通过样例" --group testing true)"
[[ "$pass_output" == "✅ 通过 | code=TEST_PASS | gate=通过样例 | group=testing | mode=enforce | exit_code=0 | action=none" ]]
fail_output="$(gate_run TEST_FAIL "失败样例" --group testing bash -c 'exit 7' 2>&1 || true)"
[[ "$fail_output" == *"❌ 不通过 | code=TEST_FAIL | gate=失败样例 | group=testing | mode=enforce | exit_code=7 | action=fix_and_retry"* ]]
grep -F $'TEST_FAIL\t7\t失败样例\ttesting' "$BATCH_GATE_FAILURE_FILE" >/dev/null
if summary_output="$(gate_assert_collected 2>&1)"; then
  echo "聚合断言未拦截已记录的失败" >&2
  exit 1
fi
[[ "$summary_output" == *"❌ 不通过 | code=TEST_FAIL | gate=失败样例 | group=testing | mode=enforce | exit_code=7 | action=fix_and_retry"* ]]
gate_reset_collected
summary_output="$(gate_assert_collected)"
[[ "$summary_output" == "✅ 通过 | code=GATE_COLLECTION_SUMMARY | gate=门禁失败汇总 | group=general | mode=enforce | exit_code=0 | action=none" ]]
echo "门禁聚合模式测试通过"

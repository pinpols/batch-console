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
pass_output="$(gate_run TEST_PASS "通过样例" true)"
[[ "$pass_output" == "✅ 通过 | code=TEST_PASS | gate=通过样例 | exit_code=0 | action=none" ]]
fail_output="$(gate_run TEST_FAIL "失败样例" bash -c 'exit 7' 2>&1 || true)"
[[ "$fail_output" == *"❌ 不通过 | code=TEST_FAIL | gate=失败样例 | exit_code=7 | action=fix_and_retry"* ]]
grep -F $'TEST_FAIL\t7\t失败样例' "$BATCH_GATE_FAILURE_FILE" >/dev/null
if summary_output="$(gate_assert_collected 2>&1)"; then
  echo "聚合断言未拦截已记录的失败" >&2
  exit 1
fi
[[ "$summary_output" == *"❌ 不通过 | code=TEST_FAIL | gate=失败样例 | exit_code=7 | action=fix_and_retry"* ]]
gate_reset_collected
summary_output="$(gate_assert_collected)"
[[ "$summary_output" == "✅ 通过 | code=GATE_COLLECTION_SUMMARY | gate=门禁失败汇总 | exit_code=0 | action=none" ]]
echo "门禁聚合模式测试通过"

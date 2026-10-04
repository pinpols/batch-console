#!/usr/bin/env bash
# 本地与 CI 共用的门禁结果及失败聚合实现。

gate_failure_file() {
  printf '%s\n' "${BATCH_GATE_FAILURE_FILE:-${RUNNER_TEMP:-${TMPDIR:-/tmp}}/batch-console-gate-failures.tsv}"
}

gate_result() {
  local status="$1"
  local code="$2"
  local name="$3"
  local exit_code="${4:-0}"
  local line
  if [[ "$status" == "PASS" ]]; then
    line="✅ 通过 | code=${code} | gate=${name} | exit_code=0"
  else
    line="❌ 不通过 | code=${code} | gate=${name} | exit_code=${exit_code}"
  fi
  printf '%s\n' "$line"
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    printf -- '- %s\n' "$line" >>"$GITHUB_STEP_SUMMARY"
  fi
}

gate_record_failure() {
  local failure_file
  failure_file="$(gate_failure_file)"
  mkdir -p "$(dirname "$failure_file")"
  printf '%s\t%s\t%s\n' "$1" "$3" "$2" >>"$failure_file"
}

gate_run() {
  local code="$1"
  local name="$2"
  shift 2
  if "$@"; then
    gate_result PASS "$code" "$name"
    return 0
  else
    local exit_code=$?
  fi
  gate_result FAIL "$code" "$name" "$exit_code" >&2
  if [[ "${BATCH_GATE_COLLECT:-0}" == "1" ]]; then
    gate_record_failure "$code" "$name" "$exit_code"
    return 0
  fi
  return "$exit_code"
}

gate_reset_collected() {
  rm -f "$(gate_failure_file)"
}

gate_assert_collected() {
  local failure_file
  failure_file="$(gate_failure_file)"
  if [[ ! -s "$failure_file" ]]; then
    gate_result PASS GATE_COLLECTION_SUMMARY "门禁失败汇总"
    return 0
  fi

  local count=0
  local code
  local exit_code
  local name
  local summary="## 门禁失败汇总"
  while IFS=$'\t' read -r code exit_code name; do
    ((count += 1))
    printf '❌ 不通过 %s | code=%s | exit_code=%s\n' "$name" "$code" "$exit_code" >&2
    summary+=$'\n'"- ${name} (code=${code}, exit_code=${exit_code})"
  done <"$failure_file"
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    printf '%s\n' "$summary" >>"$GITHUB_STEP_SUMMARY"
  fi
  printf '共 %d 项门禁失败，详见上述各检查日志。\n' "$count" >&2
  return 1
}

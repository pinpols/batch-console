#!/usr/bin/env bash
# 本地与 CI 共用的门禁结果及失败聚合实现。

gate_failure_file() {
  printf '%s\n' "${BATCH_GATE_FAILURE_FILE:-${RUNNER_TEMP:-${TMPDIR:-/tmp}}/batch-console-gate-failures.tsv}"
}

gate_mode_valid() {
  [[ "$1" == enforce || "$1" == report || "$1" == ignore ]]
}

gate_mode_from_map() {
  local mapping="$1"
  local expected_key="$2"
  local entry key mode matched="" old_ifs="$IFS"
  IFS=','
  for entry in $mapping; do
    IFS="$old_ifs"
    if [[ "$entry" != *=* ]]; then
      printf '❌ 不通过 | code=FE_GATE_MODE_INVALID | gate=门禁模式控制 | group=governance | mode=enforce | exit_code=2 | action=fix_and_retry | reason=控制项缺少等号: %s\n' "$entry" >&2
      return 2
    fi
    key="${entry%%=*}"
    mode="${entry#*=}"
    if [[ ! "$key" =~ ^[A-Za-z0-9][A-Za-z0-9_-]*$ ]] || ! gate_mode_valid "$mode"; then
      printf '❌ 不通过 | code=FE_GATE_MODE_INVALID | gate=门禁模式控制 | group=governance | mode=enforce | exit_code=2 | action=fix_and_retry | reason=无效控制项: %s\n' "$entry" >&2
      return 2
    fi
    [[ "$key" != "$expected_key" ]] || matched="$mode"
    IFS=','
  done
  IFS="$old_ifs"
  printf '%s' "$matched"
}

gate_resolve_mode() {
  local code="$1" group="$2"
  local enabled="${BATCH_GATE_ENABLED:-1}"
  local mode="${BATCH_GATE_MODE:-enforce}" group_mode code_mode
  case "${enabled,,}" in
    0|false|no|off) printf 'ignore'; return 0 ;;
    1|true|yes|on) ;;
    *) printf '❌ 不通过 | code=FE_GATE_MODE_INVALID | gate=门禁模式控制 | group=governance | mode=enforce | exit_code=2 | action=fix_and_retry | reason=BATCH_GATE_ENABLED=%s\n' "$enabled" >&2; return 2 ;;
  esac
  if ! gate_mode_valid "$mode"; then
    printf '❌ 不通过 | code=FE_GATE_MODE_INVALID | gate=门禁模式控制 | group=governance | mode=enforce | exit_code=2 | action=fix_and_retry | reason=BATCH_GATE_MODE=%s\n' "$mode" >&2
    return 2
  fi
  group_mode="$(gate_mode_from_map "${BATCH_GATE_GROUP_MODES:-}" "$group")" || return $?
  code_mode="$(gate_mode_from_map "${BATCH_GATE_MODES:-}" "$code")" || return $?
  [[ -z "$group_mode" ]] || mode="$group_mode"
  [[ -z "$code_mode" ]] || mode="$code_mode"
  printf '%s' "$mode"
}

gate_result() {
  local status="$1"
  local code="$2"
  local name="$3"
  local exit_code="${4:-0}"
  local group="${5:-${BATCH_GATE_GROUP:-general}}"
  local mode="${6:-${BATCH_GATE_MODE:-enforce}}"
  local line
  case "$status" in
    PASS) line="✅ 通过 | code=${code} | gate=${name} | group=${group} | mode=${mode} | exit_code=0 | action=none" ;;
    FAIL) line="❌ 不通过 | code=${code} | gate=${name} | group=${group} | mode=${mode} | exit_code=${exit_code} | action=fix_and_retry" ;;
    REPORT) line="⚠️ 报告 | code=${code} | gate=${name} | group=${group} | mode=report | exit_code=${exit_code} | action=review_report" ;;
    IGNORE) line="⏭️ 忽略 | code=${code} | gate=${name} | group=${group} | mode=ignore | exit_code=0 | action=none | reason=统一控制配置未执行该门禁" ;;
    *) return 2 ;;
  esac
  if [[ "$status" == FAIL ]]; then printf '%s\n' "$line" >&2; else printf '%s\n' "$line"; fi
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    printf -- '- %s\n' "$line" >>"$GITHUB_STEP_SUMMARY"
  fi
}

gate_filter_legacy_status_lines() {
  local line
  while IFS= read -r line || [[ -n "$line" ]]; do
    case "$line" in
      '✅ 通过 | code='*|'❌ 不通过 | code='*|'⚠️ 报告 | code='*|'⏭️ 忽略 | code='*|'⏭️ 跳过 | code='*)
        if [[ "$line" != *' | group='* || "$line" != *' | mode='* ]]; then
          continue
        fi
        ;;
    esac
    printf '%s\n' "$line"
  done
}

gate_record_failure() {
  local failure_file
  failure_file="$(gate_failure_file)"
  mkdir -p "$(dirname "$failure_file")"
  printf '%s\t%s\t%s\t%s\t%s\n' "$1" "$3" "$2" "${4:-${BATCH_GATE_GROUP:-general}}" "${5:-enforce}" >>"$failure_file"
}

gate_run() {
  local code="$1"
  local name="$2"
  local group="${BATCH_GATE_GROUP:-general}"
  local mode
  shift 2
  if (($# >= 2)) && [[ "$1" == "--group" ]]; then
    group="$2"
    shift 2
  fi
  mode="$(gate_resolve_mode "$code" "$group")" || return $?
  if [[ "$mode" == ignore ]]; then
    gate_result IGNORE "$code" "$name" 0 "$group" "$mode"
    return 0
  fi
  if "$@" > >(gate_filter_legacy_status_lines) 2> >(gate_filter_legacy_status_lines >&2); then
    gate_result PASS "$code" "$name" 0 "$group" "$mode"
    return 0
  else
    local exit_code=$?
  fi
  if [[ "$mode" == report ]]; then
    gate_result REPORT "$code" "$name" "$exit_code" "$group" "$mode"
    return 0
  fi
  gate_result FAIL "$code" "$name" "$exit_code" "$group" "$mode"
  if [[ "${BATCH_GATE_COLLECT:-0}" == "1" ]]; then
    gate_record_failure "$code" "$name" "$exit_code" "$group" "$mode"
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
    gate_result PASS GATE_COLLECTION_SUMMARY "门禁失败汇总" 0 "${BATCH_GATE_GROUP:-general}"
    return 0
  fi

  local count=0
  local code
  local exit_code
  local name
  local group
  local mode
  local summary="## 门禁失败汇总"
  while IFS=$'\t' read -r code exit_code name group mode; do
    ((count += 1))
    printf '❌ 不通过 | code=%s | gate=%s | group=%s | mode=%s | exit_code=%s | action=fix_and_retry\n' \
      "$code" "$name" "${group:-general}" "${mode:-enforce}" "$exit_code" >&2
    summary+=$'\n'"- ❌ 不通过 | code=${code} | gate=${name} | group=${group:-general} | mode=${mode:-enforce} | exit_code=${exit_code} | action=fix_and_retry"
  done <"$failure_file"
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    printf '%s\n' "$summary" >>"$GITHUB_STEP_SUMMARY"
  fi
  printf '共 %d 项门禁失败，详见上述各检查日志。\n' "$count" >&2
  return 1
}

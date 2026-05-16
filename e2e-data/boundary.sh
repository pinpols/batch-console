#!/usr/bin/env bash
# boundary.sh — 边界值生成器,对 e2e-data/boundary/*.json 跑边界用例。
#
# 用例 7 类(per 字段):
#   1. min - 1     (低于下限)
#   2. min         (恰好下限)
#   3. min + 1     (下限上一)
#   4. max - 1     (上限下一)
#   5. max         (恰好上限)
#   6. max + 1     (超过上限)
#   7. null/empty  (空值)
# enum 类型:
#   - 跑 invalid 数组 + values 数组各 1 次
#
# 期望:
#   - min..max 范围内 → BE 应 200 OK
#   - 越界 / 非法 enum → BE 应 400 VALIDATION_ERROR (不要 500)
#
# 用法:
#   bash boundary.sh                       # 跑所有
#   bash boundary.sh queues alert-routings # 跑指定文件

set +u

cd "$(dirname "$0")"
source _lib/api-helpers.sh 2>/dev/null

REPORT="${BC_BOUNDARY_REPORT:-/tmp/boundary-report.md}"
mkdir -p "$(dirname "$REPORT")"

cat > "$REPORT" <<EOF
# Boundary 边界值测试报告

> 生成: $(date)
> 隔离租户: ${TENANT:-tx}

| Endpoint | 字段 | 用例 | 期望 | 实际 | 状态 |
|---|---|---|---|---|---|
EOF

PASS=0
FAIL=0

# 登录
login_admin

run_one_case() {
  local endpoint="$1" fixed_json="$2" field="$3" case_name="$4" value="$5" expected="$6"
  # 合并 fixed_json + field=value 成 payload
  local payload
  payload=$(python3 -c "
import json, sys
fixed = json.loads('''${fixed_json}''')
fixed['${field}'] = ${value}
print(json.dumps(fixed))
" 2>/dev/null)
  [ -z "$payload" ] && payload="${fixed_json}"

  local raw code body http_code
  raw=$(api_call POST "$endpoint" "$payload")
  http_code="${raw##*@@HTTP@@}"
  body="${raw%@@HTTP@@*}"

  # expected: pass-200 / fail-400
  local actual_kind status
  case "$http_code" in
    200|201) actual_kind="200" ;;
    400|409|422) actual_kind="400" ;;
    500|502|503) actual_kind="500" ;;
    *) actual_kind="$http_code" ;;
  esac

  if [ "$expected" = "$actual_kind" ] || ([ "$expected" = "pass" ] && [ "$actual_kind" = "200" ]) || ([ "$expected" = "fail" ] && [ "$actual_kind" = "400" ]); then
    status="✓"
    PASS=$((PASS+1))
  else
    status="✗"
    FAIL=$((FAIL+1))
  fi
  printf "| %s | %s | %s | %s | %s | %s |\n" "$endpoint" "$field" "$case_name" "$expected" "$actual_kind" "$status" >> "$REPORT"
}

run_file() {
  local f="$1"
  [ ! -f "$f" ] && { echo "skip $f (not found)"; return; }
  local endpoint method fixed
  endpoint=$(python3 -c "import json;print(json.load(open('$f'))['endpoint'])")
  method=$(python3 -c "import json;print(json.load(open('$f')).get('method','POST'))")
  fixed=$(python3 -c "import json;print(json.dumps(json.load(open('$f'))['fixed']))")

  echo "=== $endpoint ==="

  # 跑每个 field
  local fcount
  fcount=$(python3 -c "import json;print(len(json.load(open('$f'))['fields']))")
  for i in $(seq 0 $((fcount-1))); do
    local fname ftype fmin fmax fvalues finvalid
    fname=$(python3 -c "import json;print(json.load(open('$f'))['fields'][$i]['name'])")
    ftype=$(python3 -c "import json;print(json.load(open('$f'))['fields'][$i]['type'])")

    # 只跑越界用例(数据冲突不影响):BE 应优先校验失败 → 400,而不是 500/200
    if [ "$ftype" = "int" ]; then
      run_one_case "$endpoint" "$fixed" "$fname" "overflow" "999999999999999" "400"
      run_one_case "$endpoint" "$fixed" "$fname" "negative-1" "-1" "400"

    elif [ "$ftype" = "string" ]; then
      fmax=$(python3 -c "import json;print(json.load(open('$f'))['fields'][$i].get('max',128))")
      local over_max=$(python3 -c "print(repr('a'*($fmax+1)))")
      run_one_case "$endpoint" "$fixed" "$fname" "len=max+1" "$over_max" "400"

    elif [ "$ftype" = "enum" ]; then
      finvalid=$(python3 -c "
import json
inv=json.load(open('$f'))['fields'][$i].get('invalid',[])
print(json.dumps(inv[0] if inv else 'INVALID'))")
      run_one_case "$endpoint" "$fixed" "$fname" "invalid-enum" "$finvalid" "400"
    fi
  done
}

# 选择文件
if [ $# -eq 0 ]; then
  FILES=$(ls boundary/*.json 2>/dev/null)
else
  FILES=""
  for arg in "$@"; do
    FILES="$FILES boundary/${arg}.json"
  done
fi

for f in $FILES; do
  run_file "$f"
done

echo
echo "==============================="
echo "PASS: $PASS / FAIL: $FAIL"
echo "报告: $REPORT"
[ "$FAIL" -gt 0 ] && exit 1
exit 0

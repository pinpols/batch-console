#!/usr/bin/env bash
# verify-data.sh — 只读核验保留的历史输入文件完整性；不证明当前 schema/API 兼容
# 用法:  ./verify-data.sh

set +e
set -o pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR" || exit 1

PASS=0
FAIL=0
WARN=0

ok()  { echo "  ✓ $1"; PASS=$((PASS+1)); }
bad() { echo "  ✗ $1"; FAIL=$((FAIL+1)); }
warn(){ echo "  ⚠ $1"; WARN=$((WARN+1)); }

check_json() {
  local f="$1"
  if [ ! -f "$f" ]; then bad "$f 不存在"; return; fi
  python3 -c "import json; json.load(open('$f'))" 2>/dev/null && ok "$f JSON 合法" || bad "$f JSON 解析失败"
}

check_xlsx() {
  local f="$1"
  if [ ! -f "$f" ] && [ ! -L "$f" ]; then bad "$f 不存在"; return; fi
  local out
  out=$(python3 -c "
import openpyxl
wb = openpyxl.load_workbook('$f', read_only=True)
print(','.join(wb.sheetnames))
" 2>&1)
  if [ $? -eq 0 ]; then
    ok "$f ($out)"
  else
    bad "$f 打不开:$out"
  fi
}

check_sql() {
  local f="$1"
  if [ ! -f "$f" ]; then bad "$f 不存在"; return; fi
  # 基础语法:有 BEGIN/COMMIT
  if grep -q "BEGIN" "$f" && grep -q "COMMIT" "$f"; then
    ok "$f 有事务包裹"
  else
    warn "$f 缺 BEGIN/COMMIT 事务"
  fi
}

echo "本检查只核验历史文件可解析，不代表当前 WDI 契约或业务验收。"
echo "═════════ 00-tenant-lifecycle ═════════"
check_json 00-tenant-lifecycle/payloads/single-create.json
check_json 00-tenant-lifecycle/payloads/batch-create.json
check_json 00-tenant-lifecycle/payloads/batch-init.json
check_json 00-tenant-lifecycle/payloads/tenant-copy.json
check_json 00-tenant-lifecycle/payloads/quota-request.json


echo "═════════ 01-tenant-config-import ═════════"
check_xlsx 01-tenant-config-import/ta-tenant-config-package-test.xlsx
check_xlsx 01-tenant-config-import/tb-tenant-config-package-test.xlsx
check_xlsx 01-tenant-config-import/tc-tenant-config-package-test.xlsx

echo "═════════ 02-excel-edge-cases ═════════"
check_xlsx 02-excel-edge-cases/bad-missing-required-col.xlsx
check_xlsx 02-excel-edge-cases/bad-invalid-enum.xlsx
check_xlsx 02-excel-edge-cases/bad-too-large.xlsx
# 核对历史 job_definition/schedule_type 模板的既有变异；不将其视为当前后端模板契约。
if python3 - <<'PY' 2>&1 | sed 's/^/  /'; then
import openpyxl
src = 'bad-missing-required-col.xlsx'
ws = openpyxl.load_workbook(f'02-excel-edge-cases/{src}', read_only=True)['job_definition']
header = [c.value for c in next(ws.iter_rows(min_row=1, max_row=1))]
print(f'{src} job_definition cols: {len(header)}, job_code 缺失:{"job_code" not in header}')

ws = openpyxl.load_workbook('02-excel-edge-cases/bad-invalid-enum.xlsx', read_only=True)['job_definition']
rows = list(ws.iter_rows(min_row=2, max_row=2, values_only=True))
header = [c.value for c in next(openpyxl.load_workbook('02-excel-edge-cases/bad-invalid-enum.xlsx', read_only=True)['job_definition'].iter_rows(min_row=1, max_row=1))]
st_idx = header.index('schedule_type')
print(f'bad-invalid-enum.xlsx row2.schedule_type = {rows[0][st_idx]}')

ws = openpyxl.load_workbook('02-excel-edge-cases/bad-too-large.xlsx', read_only=True)['job_definition']
print(f'bad-too-large.xlsx job_definition rows: {ws.max_row}')
PY
  ok "历史 Excel 结构信息可读取"
else
  bad "历史 Excel 结构信息读取失败"
fi

echo "═════════ 03-job-instance-states ═════════"
check_sql archive/03-job-instance-states/seed-job-instances.sql

echo "═════════ 04-approvals-pending ═════════"
check_sql archive/04-approvals-pending/seed-pending-approvals.sql

echo "═════════ 05-config-release-flow ═════════"
for f in 05-config-release-flow/payloads/*.json; do check_json "$f"; done

echo "═════════ 06-file-pipeline ═════════"
[ -f 06-file-pipeline/samples/sample-orders.csv ] && ok "sample-orders.csv" || bad "sample-orders.csv 缺"
[ -f 06-file-pipeline/samples/sample-empty.csv ] && ok "sample-empty.csv (0 byte)" || bad "缺"
file 06-file-pipeline/samples/sample-invalid-encoding.csv 2>&1 | grep -q "UTF-16" && ok "sample-invalid-encoding.csv 是 UTF-16" || warn "sample-invalid-encoding.csv 不是 UTF-16"
for f in 06-file-pipeline/payloads/*.json; do check_json "$f"; done

echo "═════════ 07-outbox-stuck ═════════"
check_sql archive/07-outbox-stuck/seed-outbox-stuck.sql

echo "═════════ 08-system-level ═════════"
for f in 08-system-level/payloads/*.json; do check_json "$f"; done

echo "═════════ 09-self-service ═════════"
for f in 09-self-service/payloads/*.json; do check_json "$f"; done

echo "═════════ 10-rbac-users ═════════"
check_json 10-rbac-users/users.json
check_sql archive/10-rbac-users/seed-users.sql

echo "历史造数/清理脚本与 SQL 已移至 archive/；只读核对 SQL 事务标记，不执行。"

echo
echo "═══════════════════════════════════════════"
echo "  ✓ $PASS  ⚠ $WARN  ✗ $FAIL"
exit $FAIL

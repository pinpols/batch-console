#!/usr/bin/env bash
# trigger-and-wait.sh — 用 admin token 在某租户触发 jobCode,等几秒拉一次 instance 验证
# 比 SQL seed 更"真实"(走完整调度链路)。
#
# 用法:  ./trigger-and-wait.sh ta TA_INC_ORDER_AGG
#        ./trigger-and-wait.sh ta TA_INC_ORDER_AGG '{"bizDate":"2026-05-01"}'

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
source "$DIR/../_lib/auth.sh"

TENANT="${1:?usage: trigger-and-wait.sh <tenant> <jobCode> [payload]}"
JOB_CODE="${2:?missing jobCode}"
PAYLOAD="${3:-{}}"

echo "[*] trigger tenant=$TENANT jobCode=$JOB_CODE"
curl -s -X POST "$BC_API_BASE/api/console/jobs/trigger" \
  -H "$H_AUTH" -H "X-Tenant-Id: $TENANT" -H "$H_JSON" \
  -H "Idempotency-Key: trigger-$(uuidgen | head -c 8)" \
  -d "{\"jobCode\":\"$JOB_CODE\",\"tenantId\":\"$TENANT\",\"payload\":$PAYLOAD}" \
  | python3 -m json.tool

echo
echo "[*] wait 8s for instance to appear..."
sleep 8

curl -s -H "$H_AUTH" -H "X-Tenant-Id: $TENANT" \
  "$BC_API_BASE/api/console/queries/job-instances?tenantId=$TENANT&jobCode=$JOB_CODE&pageNo=1&pageSize=5" \
  | python3 -c '
import sys, json
d = json.loads(sys.stdin.read()).get("data") or {}
items = d.get("items") or d.get("rows") or []
for it in items[:5]:
  print(f"  {it.get(\"instanceNo\",it.get(\"id\")):<30} {it.get(\"status\"):<12} {it.get(\"bizDate\")}")
'

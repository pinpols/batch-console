#!/usr/bin/env bash
# seed-tenants.sh — 一键造测试租户(td/te/tf/tg/th)
#
# 默认串联跑:
#   1. 单个新增 td
#   2. tenant-init 给 td 初始化 default-tenant 模板
#   3. 批量新增 te/tf/tg(自动 initConfigFrom=default-tenant)
#   4. tenant-copy ta → th
#
# 用法:
#   ./seed-tenants.sh                   # 跑全部 4 步
#   BC_API_BASE=http://localhost:18080 ./seed-tenants.sh
#   STEP=1 ./seed-tenants.sh            # 只跑第 N 步

set -e
BC_API_BASE="${BC_API_BASE:-http://localhost:18080}"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASS="${ADMIN_PASS:-admin123}"

cd "$(dirname "$0")"

# 登录拿 token
echo "[*] login as $ADMIN_USER"
TOK=$(curl -s -X POST "$BC_API_BASE/api/console/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}" \
  | python3 -c 'import sys,json; print(json.loads(sys.stdin.read())["data"]["accessToken"])')
[ -z "$TOK" ] && echo "login failed" && exit 1

H_AUTH="Authorization: Bearer $TOK"
H_TENANT="X-Tenant-Id: system"
H_JSON="Content-Type: application/json"

# 生成幂等 key(每次执行不同,允许重试)
gen_idem() { python3 -c "import uuid; print('seed-' + uuid.uuid4().hex[:16])"; }

run_step() {
  local n="$1"; local desc="$2"
  if [ -n "$STEP" ] && [ "$STEP" != "$n" ]; then return; fi
  echo
  echo "[$n] $desc"
}

# Step 1: 单个新增 td
run_step 1 "POST /tenants — single create td"
if [ -z "$STEP" ] || [ "$STEP" = "1" ]; then
  curl -s -X POST "$BC_API_BASE/api/console/tenants" \
    -H "$H_AUTH" -H "$H_TENANT" -H "$H_JSON" \
    -H "Idempotency-Key: $(gen_idem)" \
    -d "$(grep -v '_doc' payloads/single-create.json)" \
    | python3 -m json.tool || true
fi

# Step 2: tenant-init for td (从 default-tenant 复制完整 spec)
run_step 2 "POST /config/tenant-init — init td from default-tenant snapshot"
if [ -z "$STEP" ] || [ "$STEP" = "2" ]; then
  # 先拉 default-tenant 的整 spec
  echo "  [2.1] pull spec from default-tenant"
  SPEC=$(curl -s "$BC_API_BASE/api/console/config/sync/export?tenantId=default-tenant" \
    -H "$H_AUTH" -H "$H_TENANT" \
    -X POST -H "$H_JSON" -d '{}')
  # 注意 export 返回是 CommonResponse,data 是 spec
  echo "  [2.2] post tenant-init"
  python3 - <<PY
import json, sys, urllib.request
spec_resp = json.loads("""$SPEC""")
spec = spec_resp.get("data") or {}
body = {
  "targetTenantIds": ["td"],
  "mode": "SKIP_EXISTING",
  "dryRun": False,
  **spec  # flatten 到顶层
}
import uuid
req = urllib.request.Request(
  "$BC_API_BASE/api/console/config/tenant-init",
  data=json.dumps(body).encode(),
  headers={
    "Authorization":"Bearer $TOK",
    "X-Tenant-Id":"system",
    "Content-Type":"application/json",
    "Idempotency-Key":"seed-init-"+uuid.uuid4().hex[:16]
  },
  method="POST"
)
try:
  print(urllib.request.urlopen(req,timeout=30).read().decode()[:800])
except urllib.error.HTTPError as e:
  print("HTTP", e.code, e.read().decode()[:400])
PY
fi

# Step 3: 批量新增 te/tf/tg with auto-init
run_step 3 "POST /tenants/batch — batch create te/tf/tg + auto-init from default-tenant"
if [ -z "$STEP" ] || [ "$STEP" = "3" ]; then
  curl -s -X POST "$BC_API_BASE/api/console/tenants/batch" \
    -H "$H_AUTH" -H "$H_TENANT" -H "$H_JSON" \
    -H "Idempotency-Key: $(gen_idem)" \
    -d "$(grep -v '_doc' payloads/batch-create.json)" \
    | python3 -m json.tool || true
fi

# Step 4: tenant-copy ta → th(先建空壳)
run_step 4 "POST /tenants(th 空壳) + /config/tenant-copy ta → th"
if [ -z "$STEP" ] || [ "$STEP" = "4" ]; then
  curl -s -X POST "$BC_API_BASE/api/console/tenants" \
    -H "$H_AUTH" -H "$H_TENANT" -H "$H_JSON" \
    -H "Idempotency-Key: $(gen_idem)" \
    -d '{"tenantId":"th","tenantName":"测试租户 H","description":"copy 目标","username":"op-th","password":"TestOp@2026Th"}' \
    | python3 -m json.tool || true
  curl -s -X POST "$BC_API_BASE/api/console/config/tenant-copy" \
    -H "$H_AUTH" -H "$H_TENANT" -H "$H_JSON" \
    -H "Idempotency-Key: $(gen_idem)" \
    -d "$(grep -v '_doc' payloads/tenant-copy.json)" \
    | python3 -m json.tool || true
fi

echo
echo "[*] done. 验证: GET /api/console/tenants 看到 td/te/tf/tg/th"

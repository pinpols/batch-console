#!/usr/bin/env bash
# seed-import-template-fixture.sh — 修复 e2e 种子缺陷
#
# 问题:ta 租户的 IMPORT 模板 IMP-CUSTOMER-CSV(id=5005)的
#       load_target_ref 字段为 NULL,导致 worker-import 启动时报
#       「jdbc_mapped_import spec missing」(V29 migration 应填但 ta seed 漏了)。
#
# 修复:通过 console API 把 load_target_ref 置为 'jdbc_mapped'。
#       query_param_schema.jdbcMappedImport 已存在,无需补。
#
# 用法:bash e2e-data/seed-import-template-fixture.sh
# 影响:仅 ta 租户测试数据,不动其他租户

set -u
DIR="$(cd "$(dirname "$0")" && pwd)"

JAR=$(mktemp /tmp/seed-fixture-jar.XXXXX)
trap 'rm -f "$JAR"' EXIT

curl -sf -c "$JAR" -X POST "http://localhost:18080/api/console/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' > /dev/null
[ ! -s "$JAR" ] && { echo "[auth] login failed"; exit 1; }
echo "[fixture] admin logged in"

# 查 ta 所有 IMPORT 模板
TEMPLATES=$(curl -s -b "$JAR" -H "X-Tenant-Id: ta" \
  "http://localhost:18080/api/console/file-templates?tenantId=ta&pageNo=1&pageSize=50" | \
  python3 -c "
import json,sys
d=json.load(sys.stdin).get('data',{})
for i in d.get('items',[]):
    if i.get('template_type')=='IMPORT' and not i.get('load_target_ref'):
        print(i['id'], i.get('template_code',''))
")

if [ -z "$TEMPLATES" ]; then
  echo "[fixture] ✓ 所有 IMPORT 模板都已配置 load_target_ref"
  exit 0
fi

echo "[fixture] 待修复的 IMPORT 模板:"
echo "$TEMPLATES"

# 逐条更新
while IFS=' ' read -r TID TCODE; do
  [ -z "$TID" ] && continue
  echo "[fixture] 更新 id=$TID code=$TCODE → load_target_ref='jdbc_mapped'"
  RESP=$(curl -s -b "$JAR" -X PUT "http://localhost:18080/api/console/file-templates/$TID?tenantId=ta" \
    -H "X-Tenant-Id: ta" -H "Content-Type: application/json" \
    -H "Idempotency-Key: seed-fix-$(date +%s)-$TID" \
    -d "{\"tenantId\":\"ta\",\"templateCode\":\"$TCODE\",\"loadTargetRef\":\"jdbc_mapped\"}")
  echo "  → ${RESP:0:200}"
done <<< "$TEMPLATES"

# 验证
echo
echo "[fixture] 验证:"
curl -s -b "$JAR" -H "X-Tenant-Id: ta" \
  "http://localhost:18080/api/console/file-templates?tenantId=ta&pageNo=1&pageSize=50" | \
  python3 -c "
import json,sys
d=json.load(sys.stdin).get('data',{})
for i in d.get('items',[]):
    if i.get('template_type')=='IMPORT':
        print(f\"  id={i.get('id')} code={i.get('template_code')} load_target_ref={i.get('load_target_ref')}\")
"

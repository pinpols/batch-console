#!/usr/bin/env bash
# cleanup-config.sh — B 档清理:把租户配置重置回 01- Excel 包里的 baseline
# 通过重新上传 ta/tb/tc 各自的 Excel 包(覆盖模式)实现。
#
# 用法:
#   ./cleanup-config.sh ta
#   ./cleanup-config.sh ta tb tc

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
source "$DIR/_lib/auth.sh"

if [ $# -eq 0 ]; then
  echo "usage: $0 <tenantId>..."; exit 1
fi

reimport_one() {
  local T="$1"
  local PKG="$DIR/01-tenant-config-import/${T}-tenant-config-package-test.xlsx"
  if [ ! -f "$PKG" ]; then
    echo "[config-clean] $T: package not found at $PKG, skip"
    return
  fi

  echo
  echo "[config-clean] tenant=$T  re-uploading $PKG"
  # multipart upload to tenant-package endpoint
  curl -s -X POST "$BC_API_BASE/api/console/config/tenant-package/excel/upload" \
    -H "$H_AUTH" \
    -H "X-Tenant-Id: $T" \
    -F "file=@$PKG" \
    -F "mode=UPSERT" \
    -F "dryRun=false" \
    | python3 -c '
import sys,json
try:
  d=json.loads(sys.stdin.read())
  print("    code=",d.get("code"),"  msg=",d.get("message"))
except Exception as e:
  print("    parse-fail:",e)
'
}

for T in "$@"; do reimport_one "$T"; done
echo
echo "[config-clean] done"

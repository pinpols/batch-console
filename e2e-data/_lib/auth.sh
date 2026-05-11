#!/usr/bin/env bash
# 公共:登录拿 admin token,设置常用 header
# source _lib/auth.sh 后即可用 $TOK / $H_AUTH / $H_TENANT_SYSTEM / $BC_API_BASE

BC_API_BASE="${BC_API_BASE:-http://localhost:18080}"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASS="${ADMIN_PASS:-admin123}"

TOK=$(curl -s -X POST "$BC_API_BASE/api/console/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}" \
  | python3 -c 'import sys,json; print(json.loads(sys.stdin.read())["data"]["accessToken"])' 2>/dev/null)

if [ -z "$TOK" ]; then
  echo "[auth] login failed for $ADMIN_USER on $BC_API_BASE" >&2
  return 1 2>/dev/null || exit 1
fi

H_AUTH="Authorization: Bearer $TOK"
H_TENANT_SYSTEM="X-Tenant-Id: system"
H_JSON="Content-Type: application/json"

export TOK BC_API_BASE H_AUTH H_TENANT_SYSTEM H_JSON

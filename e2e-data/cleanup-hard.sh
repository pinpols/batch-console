#!/usr/bin/env bash
# cleanup-hard.sh — C 档清理:整轮测试结束,删除所有临时租户 + 系统级测试实体
# 永久基线租户(ta/tb/tc)只软重置,不删除。
#
# 默认安全策略:
#   - 删除 td/te/tf/tg/th(临时租户,匹配前缀正则)
#   - 删除带 test-* 前缀的 APIKey/Webhook/Tag/NotificationChannel/User
#   - 跳过 system / default / default-tenant / ta / tb / tc
#
# 用法:
#   ./cleanup-hard.sh                  # 干模式 dry-run,只打印不删
#   ./cleanup-hard.sh --execute        # 真删

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
source "$DIR/_lib/auth.sh"

DRYRUN=1
[ "$1" = "--execute" ] && DRYRUN=0

PROTECTED_TENANTS="system default default-tenant ta tb tc"
TEMP_TENANT_REGEX='^(td|te|tf|tg|th)$'

is_protected() {
  for x in $PROTECTED_TENANTS; do [ "$x" = "$1" ] && return 0; done
  return 1
}
is_temp() { [[ "$1" =~ $TEMP_TENANT_REGEX ]]; }

run_or_dry() {
  if [ "$DRYRUN" = "1" ]; then
    echo "  [dry] $*"
  else
    eval "$@"
  fi
}

echo "[hard-clean] mode=$([ $DRYRUN -eq 1 ] && echo DRY-RUN || echo EXECUTE)"
echo

# ── 1. 删除临时租户 ──
echo "[1] tenants — listing"
TENANTS_JSON=$(curl -s -H "$H_AUTH" -H "$H_TENANT_SYSTEM" \
  "$BC_API_BASE/api/console/tenants?pageNo=1&pageSize=100")
TENANTS=$(echo "$TENANTS_JSON" | python3 -c '
import sys,json
d=json.loads(sys.stdin.read()).get("data") or {}
items=d.get("items") or d.get("rows") or []
for r in items: print(r.get("tenantId",""))
')

for T in $TENANTS; do
  if is_temp "$T"; then
    echo "  -> delete temp tenant: $T"
    run_or_dry "curl -s -X POST '$BC_API_BASE/api/console/tenants/$T/suspend' -H \"$H_AUTH\" -H \"$H_TENANT_SYSTEM\" >/dev/null"
    run_or_dry "curl -s -X DELETE '$BC_API_BASE/api/console/tenants/$T' -H \"$H_AUTH\" -H \"$H_TENANT_SYSTEM\" >/dev/null"
  elif is_protected "$T"; then
    : # silent
  else
    echo "  ?  unknown tenant: $T (skip — 不在白名单也不在临时池,保守跳过)"
  fi
done

# ── 2. 删除测试 APIKey ──
echo
echo "[2] api-keys (name prefix 'test-')"
curl -s -H "$H_AUTH" -H "$H_TENANT_SYSTEM" \
  "$BC_API_BASE/api/console/queries/api-keys?pageNo=1&pageSize=200" \
  | python3 -c '
import sys,json
d=json.loads(sys.stdin.read()).get("data") or {}
items=d.get("items") or d.get("rows") or []
for r in items:
  name=str(r.get("name") or r.get("keyName") or "")
  rid=r.get("id") or r.get("apiKeyId")
  if name.startswith("test-") and rid: print(rid, name)
' | while read RID NAME; do
  echo "  -> delete api-key: $RID $NAME"
  run_or_dry "curl -s -X DELETE '$BC_API_BASE/api/console/api-keys/$RID' -H \"$H_AUTH\" -H \"$H_TENANT_SYSTEM\" >/dev/null"
done

# ── 3. 删除测试 Webhook ──
echo
echo "[3] webhooks (name prefix 'test-')"
curl -s -H "$H_AUTH" -H "$H_TENANT_SYSTEM" \
  "$BC_API_BASE/api/console/queries/webhooks?pageNo=1&pageSize=200" \
  | python3 -c '
import sys,json
d=json.loads(sys.stdin.read()).get("data") or {}
items=d.get("items") or d.get("rows") or []
for r in items:
  name=str(r.get("name") or "")
  rid=r.get("id") or r.get("webhookId")
  if name.startswith("test-") and rid: print(rid, name)
' | while read RID NAME; do
  echo "  -> delete webhook: $RID $NAME"
  run_or_dry "curl -s -X DELETE '$BC_API_BASE/api/console/webhooks/$RID' -H \"$H_AUTH\" -H \"$H_TENANT_SYSTEM\" >/dev/null"
done

# ── 4. 删除测试 Tag ──
echo
echo "[4] tags (name prefix 'test-')"
echo "  -> 用 DELETE /tags?name=test-* 单删,或调 /tags/all 后再重建"
echo "  (实现略,需 BE 支持按 name 过滤删除)"

# ── 5. 删除测试用户 ──
echo
echo "[5] users (username prefix 'test-' or 'op-tx')"
curl -s -H "$H_AUTH" -H "$H_TENANT_SYSTEM" \
  "$BC_API_BASE/api/console/queries/users?pageNo=1&pageSize=200" \
  | python3 -c '
import sys,json,re
d=json.loads(sys.stdin.read()).get("data") or {}
items=d.get("items") or d.get("rows") or []
TEMP=re.compile(r"^(test-|op-(td|te|tf|tg|th))")
for r in items:
  u=str(r.get("username") or "")
  rid=r.get("id") or r.get("userId")
  if TEMP.match(u) and rid: print(rid, u)
' | while read RID UN; do
  echo "  -> delete user: $RID $UN"
  run_or_dry "curl -s -X DELETE '$BC_API_BASE/api/console/users/$RID' -H \"$H_AUTH\" -H \"$H_TENANT_SYSTEM\" >/dev/null"
done

echo
echo "[hard-clean] done. DRYRUN=$DRYRUN  (use --execute to actually delete)"

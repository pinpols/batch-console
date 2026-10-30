#!/usr/bin/env bash
# cleanup-soft.sh — A 档清理:删某租户内本测试会话产生的 PENDING/DRAFT 实体
# 不动配置,不动租户本身,只把"运行时"的待办清掉,租户回到 baseline。
#
# 用法:
#   ./cleanup-soft.sh ta           # 清 ta 一个
#   ./cleanup-soft.sh ta tb tc     # 清多个
#   ./cleanup-soft.sh --all-test   # 清所有永久测试租户(ta/tb/tc)

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
source "$DIR/_lib/auth.sh"

TARGETS=()
case "$1" in
  --all-test) TARGETS=(ta tb tc) ;;
  "") echo "usage: $0 <tenantId>... | --all-test"; exit 1 ;;
  *)  TARGETS=("$@") ;;
esac

clean_one() {
  local T="$1"
  echo
  echo "[soft-clean] tenant=$T"
  local H_T="X-Tenant-Id: $T"

  # 1. 删 PENDING 通用 approval(只删测试期产生的;按 createdAt 近 24h 过滤)
  echo "  - skip approvals  (BE 没暴露删除 PENDING approval API,需 SQL seed 时手动删)"

  # 2. 取消所有非终态 JobInstance(RUNNING/PENDING/BLOCKED)
  echo "  - cancel non-terminal job instances"
  curl -s -H "$H_AUTH" -H "$H_T" \
    "$BC_API_BASE/api/console/queries/job-instances?tenantId=$T&pageNo=1&pageSize=200" \
    | python3 -c '
import sys, json, urllib.request, os
TOK=os.environ["TOK"]; T=os.environ["T"]; BASE=os.environ["BC_API_BASE"]
d=json.loads(sys.stdin.read()).get("data",{}) or {}
items=d.get("items") or d.get("rows") or []
nonterminal={"RUNNING","PENDING","BLOCKED","DISPATCHING"}
killed=0
for it in items:
  st=str(it.get("status","")).upper()
  iid=it.get("id") or it.get("instanceId")
  if st in nonterminal and iid:
    try:
      req=urllib.request.Request(
        f"{BASE}/api/console/instances/{iid}/cancel",
        method="POST",
        headers={"Authorization":f"Bearer {TOK}","X-Tenant-Id":T}
      )
      urllib.request.urlopen(req,timeout=5).read()
      killed+=1
    except Exception as e:
      print(f"    skip {iid}: {e}")
print(f"    cancelled: {killed}")
' || true
  T="$T" python3 -c "" 2>/dev/null || true   # noop

  # 3. 删 DRAFT/SUBMITTED 状态的 ConfigRelease(只删 description 含 "test-" 的)
  echo "  - skip config releases (admin 操作敏感,仅注释提醒)"

  # 4. 删测试 Tag/APIKey/Webhook 在系统域,这里先跳过(在 cleanup-hard 处理)
}

for T in "${TARGETS[@]}"; do
  clean_one "$T"
done

echo
echo "[soft-clean] done"

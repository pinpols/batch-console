#!/usr/bin/env bash
# RBAC × tenant-switch 快速验证。
# 对 6 个角色用户分别测:
#   1. login 是否成功 + 拿到 menus
#   2. GET /auth/me 看 authorities
#   3. 关键 endpoints 的权限边界:
#      - GET /tenants (ADMIN/AUDITOR 应可, VIEWER/TENANT_USER 可能不可)
#      - POST /queues (ADMIN/CONFIG_ADMIN/OPERATOR 应可, VIEWER/AUDITOR/TENANT_USER 应 403)
#      - DELETE /tenants/xx (仅 ADMIN)
#   4. tenant-switch: 把 X-Tenant-Id 切到 tb, GET /queries/job-definitions
#      - ADMIN/AUDITOR/CONFIG_ADMIN 允许切
#      - TENANT_USER 只能看自己 tenant

set +u
API="http://localhost:18080"

## 2026-05-17 对齐:BE 实际实现 5 角色(ADMIN/AUDITOR/CONFIG_ADMIN/TENANT_USER/USER)。
## 历史 OPERATOR/VIEWER 是菜单档位标签不是 Spring 角色,已并入 TENANT_USER/USER。
declare -a USERS=(
  "admin:admin123:ADMIN"
  "test-op-ta:TestOp@2026taX:TENANT_USER(原OPERATOR)"
  "test-viewer-ta:TestVi@2026taX:USER(原VIEWER)"
  "test-tu-ta:TestTu@2026taX:TENANT_USER"
  "test-auditor:TestAu@2026sysX:AUDITOR"
  "test-cfg-admin:TestCf@2026sysX:CONFIG_ADMIN"
)

printf "%-18s %-12s %-5s %-12s %-12s %-15s %-15s\n" "user" "role" "login" "auth/me" "menu#" "POST /queues" "切租户到 tb"
echo "─────────────────────────────────────────────────────────────────────────────────────────────"

for u in "${USERS[@]}"; do
  USERNAME=${u%%:*}
  REST=${u#*:}
  PASSWORD=${REST%%:*}
  ROLE=${REST#*:}

  JAR="/tmp/rbac-$USERNAME.jar"
  rm -f "$JAR"

  # 1. login
  LOGIN_CODE=$(/usr/bin/curl -s -o /tmp/rbac-login.json -w "%{http_code}" -c "$JAR" -X POST "$API/api/console/auth/login" \
    -H "Content-Type: application/json" -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")
  if [ "$LOGIN_CODE" != "200" ]; then
    printf "%-18s %-12s %-5s\n" "$USERNAME" "$ROLE" "FAIL($LOGIN_CODE)"
    continue
  fi

  # 2. auth/me
  ME=$(/usr/bin/curl -s -b "$JAR" "$API/api/console/auth/me" | python3 -c "
import json,sys
try:
  d=json.load(sys.stdin)
  data=d.get('data') or {}
  print(','.join(data.get('authorities',[])[:2]), '|menus:', len(data.get('menus',[])))
except: print('parse-fail')" 2>&1)
  MENU_CNT=$(echo "$ME" | awk -F'|' '{print $2}' | tr -d 'menus: ')
  AUTH=$(echo "$ME" | awk -F'|' '{print $1}')

  # 3. POST /queues (写操作)
  IDEM=$(uuidgen)
  POST_CODE=$(/usr/bin/curl -s -o /dev/null -w "%{http_code}" -b "$JAR" -X POST "$API/api/console/queues" \
    -H "Content-Type: application/json" -H "X-Tenant-Id: ta" -H "Idempotency-Key: $IDEM" \
    -d '{"tenantId":"ta","queueCode":"rbac-test-NEVER","queueName":"x","queueType":"IMPORT","priorityPolicy":"FIFO","fairShareWeight":1,"enabled":true}')
  case "$POST_CODE" in
    200) POST_DESC="200 OK" ;;
    403) POST_DESC="403 拒" ;;
    409) POST_DESC="409 重复(等同允许)" ;;
    *) POST_DESC="$POST_CODE" ;;
  esac

  # 4. tenant-switch: 用 X-Tenant-Id: tb 查 job-defs
  SWITCH_CODE=$(/usr/bin/curl -s -o /dev/null -w "%{http_code}" -b "$JAR" \
    -H "X-Tenant-Id: tb" "$API/api/console/queries/job-definitions?tenantId=tb&pageNo=1&pageSize=1")
  case "$SWITCH_CODE" in
    200) SWITCH_DESC="200 可切" ;;
    403) SWITCH_DESC="403 禁切" ;;
    401) SWITCH_DESC="401" ;;
    *) SWITCH_DESC="$SWITCH_CODE" ;;
  esac

  printf "%-18s %-12s %-5s %-12s %-12s %-15s %-15s\n" "$USERNAME" "$ROLE" "$LOGIN_CODE" "${AUTH:0:11}" "$MENU_CNT" "$POST_DESC" "$SWITCH_DESC"
done

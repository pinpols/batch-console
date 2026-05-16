#!/usr/bin/env bash
# cleanup-tx.sh - 删 tx 隔离测试租户 + 兜底清残留
#
# 用法:
#   bash e2e-data/cleanup-tx.sh                # 直接清
#   bash e2e-data/cleanup-tx.sh --confirm      # 二次确认(防误删)
#
# 设计:
#   1. 删租户(BE 应级联清所有从属配置)
#   2. 兜底循环清:队列/日历/告警路由/Job 定义/...(防 BE 不级联或部分级联失败)
#   3. 失败也继续(set +e):cleanup 不应卡测试

set +e
API_BASE="${BC_API_BASE:-http://localhost:18080}"
TENANT="tx"
JAR="/tmp/cleanup-tx.jar"

if [ "$1" = "--confirm" ]; then
  read -p "确认删除测试租户 $TENANT 及全部从属数据? (yes/no) " ans
  [ "$ans" != "yes" ] && { echo "取消"; exit 0; }
fi

echo "[cleanup] 登录 admin..."
LOGIN=$(curl -sf -c "$JAR" -X POST "$API_BASE/api/console/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')

if [ -z "$LOGIN" ]; then
  echo "[cleanup] 登录失败,放弃"
  exit 1
fi

count_failures=0

# 通用:按 tenant 列 + 循环删
del_entity() {
  local label="$1"
  local list_path="$2"        # 例: /api/console/queues
  local id_field="$3"         # 例: id
  # 拉列表 -> 提取 id -> 逐个 DELETE
  local items
  items=$(curl -s -b "$JAR" -H "X-Tenant-Id: $TENANT" \
    "$API_BASE$list_path?tenantId=$TENANT&pageNo=1&pageSize=200" \
    | python3 -c "
import json, sys
try:
  d = json.load(sys.stdin)
  rows = (d.get('data') or {}).get('items', [])
  for r in rows:
    v = r.get('$id_field')
    if v is not None: print(v)
except Exception:
  pass
")
  local total=0
  local fail=0
  for id in $items; do
    total=$((total+1))
    local rc
    rc=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR" -X DELETE \
      -H "X-Tenant-Id: $TENANT" -H "Idempotency-Key: $(uuidgen)" \
      "$API_BASE$list_path/$id?tenantId=$TENANT")
    if [ "$rc" != "200" ] && [ "$rc" != "204" ] && [ "$rc" != "404" ]; then
      fail=$((fail+1))
    fi
  done
  if [ $total -gt 0 ]; then
    echo "  [$label] 清理 $total 条, 失败 $fail"
    count_failures=$((count_failures+fail))
  fi
}

echo "[cleanup] 删 tx 从属配置 (兜底)..."
# 顺序:有依赖的先删上层
del_entity "告警路由"     "/api/console/alert-routings"          "id"
del_entity "Webhook"      "/api/console/notifications/webhooks"  "id"
del_entity "通知渠道"     "/api/console/notifications/channels"  "id"
del_entity "订阅规则"     "/api/console/notifications/rules"     "id"
del_entity "Pipeline"     "/api/console/pipelines"               "id"
del_entity "工作流"       "/api/console/workflow-definitions"    "id"
del_entity "Job 定义"     "/api/console/job-definitions"         "id"
del_entity "文件渠道"     "/api/console/file-channels"           "id"
del_entity "文件模板"     "/api/console/file-templates"          "id"
del_entity "节假日"       "/api/console/business-calendar-days"  "id"
del_entity "业务日历"     "/api/console/business-calendars"      "id"
del_entity "批次窗口"     "/api/console/batch-windows"           "id"
del_entity "资源队列"     "/api/console/queues"                  "id"
del_entity "配额策略"     "/api/console/quota-policies"          "id"
del_entity "Tag"          "/api/console/tags"                    "id"
del_entity "API Key"      "/api/console/api-keys"                "id"
del_entity "系统参数"     "/api/console/system-parameters"       "id"

echo "[cleanup] 删租户 tx..."
rc=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR" -X DELETE \
  -H "Idempotency-Key: $(uuidgen)" \
  "$API_BASE/api/console/tenants/$TENANT")
echo "  租户删除 HTTP $rc"

echo "[cleanup] 完成,从属删除失败累计: $count_failures"
rm -f "$JAR"
exit 0

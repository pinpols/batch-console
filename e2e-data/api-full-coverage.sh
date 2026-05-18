#!/usr/bin/env bash
# api-full-coverage.sh — D 档 P5 扩展:扫几乎全部 console-api endpoint。
#
# 跳过:SSE / AI / DELETE 整资源 / PUT 整体 / api-crud.sh 已覆盖 17 实体
# 测:全部 GET + 安全 POST(operate / approve / batch-*) + 部分 GET-by-id
#
# 用法:  bash e2e-data/api-full-coverage.sh

set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
TENANT="${TENANT:-ta}"
REPORT="${REPORT:-/tmp/api-full-coverage-report.md}"
BC_API_BASE="${BC_API_BASE:-http://localhost:18080}"

# cookie-jar 模式登录(BE 用 HttpOnly cookie,Bearer 在 /auth/me 反而 401)
JAR=$(mktemp /tmp/api-cov-jar.XXXXX)
curl -sf -c "$JAR" -X POST "$BC_API_BASE/api/console/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' > /dev/null
[ ! -s "$JAR" ] && { echo "[auth] login failed"; exit 1; }
echo "[auth] logged in,jar=$JAR"

cat > "$REPORT" <<EOF
# API 全覆盖扫描报告

生成: $(date)
租户: $TENANT
BE: $BC_API_BASE

| METHOD | PATH | STATUS | NOTE |
|---|---|---|---|
EOF

# Python 替换路径占位 + 状态分类
TMP_CALL=$(mktemp /tmp/api_call.XXXXX)

PASS=0
FAIL=0
SKIP=0
FAIL_DETAILS=$(mktemp /tmp/api_fails.XXXXX)

# 从 openapi 一次性产出 (METHOD PATH SKIP_REASON?) 列表
python3 > "$TMP_CALL" <<'PYEOF'
import re, yaml

SAMPLES = {
    'tenantId':'ta','jobCode':'TA_DISPATCH_ORDER','pipelineCode':'ta-pipeline-001',
    'workflowCode':'ta-wf-001','fileTemplateCode':'orders','channelCode':'ta-channel-001',
    'queueCode':'ta-queue-001','calendarCode':'ta-cal-001','windowCode':'ta-window-001',
    'policyCode':'ta-policy-001','routeCode':'ta-route-001','traceId':'trace-test-1',
    'approvalNo':'not-found-approval','instanceId':'1','id':'1','releaseId':'1',
    'workerCode':'worker-ta-export-001','username':'admin',
    'templateCode':'orders','keyName':'e2e-key-1','paramKey':'e2e-param-1',
    'tagKey':'e2e-tag','tagValue':'e2e-val','approvalId':'1',
    'eventKey':'e2e-key-1','batchDate':'2026-05-18','holidayDate':'2026-05-01',
    'webhookId':'1','userId':'1','apiKeyId':'1','reportTaskId':'1',
}
SKIP_PATTERNS = [r'/events$', r'/stream/', r'/ai/chat', r'/cleanup-hard']
COVERED_CRUD = {
    '/api/console/queues','/api/console/batch-windows','/api/console/calendars',
    '/api/console/quota-policies','/api/console/alert-routings','/api/console/file-templates',
    '/api/console/file-channels','/api/console/job-definitions','/api/console/pipeline-definitions',
    '/api/console/api-keys','/api/console/webhooks','/api/console/notifications/channels',
    '/api/console/notifications/rules','/api/console/workflow-definitions',
    '/api/console/system-parameters','/api/console/tags','/api/console/triggers',
}

def sub(p):
    return re.sub(r'\{([^}]+)\}', lambda m: SAMPLES.get(m.group(1),'1'), p)

with open('../file-batch-system/docs/api/console-api.openapi.yaml') as f:
    spec = yaml.safe_load(f)

for path, ops in spec.get('paths', {}).items():
    for method in sorted(ops):
        if method not in ('get','post','put','delete','patch'):
            continue
        method_u = method.upper()
        reason = ''
        if any(re.search(pat, path) for pat in SKIP_PATTERNS):
            reason = 'SSE/AI'
        elif method_u in ('PUT','DELETE') and not re.search(r'/\{', path):
            reason = 'bulk-write-skip'
        elif method_u in ('GET','POST','DELETE') and path in COVERED_CRUD:
            reason = 'covered-by-api-crud'
        # POST 路径要保守:只测明显安全的 (toggle/approve/reject/operate/pause/resume/cleanup/republish/cancel/dryRun/preview/export)
        elif method_u == 'POST' and not re.search(r'(toggle|approve|reject|operate|pause|resume|cleanup|republish|cancel|preview|export|operations|cache/evict|warmup|drain|takeover|register|unregister|compensate|compensations|rerun|stop|start|recover|catch-up|excel/upload|excel/preview|silence|ack|close|trigger|batch-|init|copy|set-current|reset|notify|test|run)', path):
            reason = 'write-needs-payload'
        # PATCH 需要 payload 跳过
        elif method_u == 'PATCH':
            reason = 'patch-needs-payload'

        real = sub(path)
        print(f"{method_u}\t{path}\t{real}\t{reason}")
PYEOF

# 调用每行
while IFS=$'\t' read -r METHOD PATH_TPL REAL REASON; do
  if [ -n "$REASON" ]; then
    SKIP=$((SKIP+1))
    continue
  fi

  URL="$BC_API_BASE$REAL"
  if [ "$METHOD" = "GET" ]; then
    URL="${URL}?tenantId=$TENANT&pageNo=1&pageSize=5"
  fi

  STATUS=$(curl -s -b "$JAR" -o /tmp/api_resp.json -w "%{http_code}" \
    -X "$METHOD" "$URL" \
    -H "X-Tenant-Id: $TENANT" -H "Content-Type: application/json" \
    --max-time 10 || echo "0")

  if [ -z "$STATUS" ] || [ "$STATUS" = "0" ]; then STATUS="TIMEOUT"; fi

  NOTE=""
  CASE=PASS
  if [ "$STATUS" = "200" ] || [ "$STATUS" = "204" ]; then
    NOTE="OK"
  elif [ "$STATUS" = "404" ]; then
    NOTE="expected not-found"
  elif [ "$STATUS" = "405" ]; then
    NOTE="method-mismatch(BE 文档/实现漂移,跳过)"
  elif [ "$STATUS" = "401" ] || [ "$STATUS" = "403" ]; then
    NOTE="auth-guard(expected)"
  elif [ "$STATUS" = "400" ]; then
    BODY=$(head -c 120 /tmp/api_resp.json | tr -d '\n')
    NOTE="validation: ${BODY:0:80}"
  elif [ "$STATUS" = "409" ]; then
    NOTE="conflict(expected for write-twice)"
  elif [ "$STATUS" = "TIMEOUT" ]; then
    CASE=FAIL
    NOTE="**timeout**"
  elif [[ "$STATUS" =~ ^5 ]]; then
    CASE=FAIL
    BODY=$(head -c 200 /tmp/api_resp.json | tr -d '\n')
    NOTE="**5xx**: ${BODY:0:150}"
  else
    CASE=FAIL
    NOTE="status $STATUS"
  fi

  if [ "$CASE" = "FAIL" ]; then
    FAIL=$((FAIL+1))
    echo "[FAIL] $STATUS $METHOD $PATH_TPL  -- ${NOTE:0:100}"
    echo "$METHOD $PATH_TPL → $STATUS :: $NOTE" >> "$FAIL_DETAILS"
  else
    PASS=$((PASS+1))
  fi
  echo "| $METHOD | \`$PATH_TPL\` | $STATUS | $NOTE |" >> "$REPORT"
done < "$TMP_CALL"

cat >> "$REPORT" <<EOF

## 统计

- PASS: **$PASS**
- FAIL (5xx/timeout): **$FAIL**
- SKIP (SSE/AI/PUT/DELETE-bulk/api-crud 已覆盖/write-needs-payload): **$SKIP**

EOF

if [ "$FAIL" -gt 0 ]; then
  echo "" >> "$REPORT"
  echo "## FAIL 明细" >> "$REPORT"
  echo "" >> "$REPORT"
  echo '```' >> "$REPORT"
  cat "$FAIL_DETAILS" >> "$REPORT"
  echo '```' >> "$REPORT"
fi

echo
echo "============================================"
echo "  PASS=$PASS  FAIL=$FAIL  SKIP=$SKIP"
echo "  报告:$REPORT"
echo "============================================"
rm -f "$TMP_CALL" "$FAIL_DETAILS"
rm -f "$JAR"

#!/usr/bin/env bash
# Phase 1: API 层 CRUD 全覆盖。在隔离租户 tx 上跑,无脏数据残留。
#
# 用法:
#   bash e2e-data/api-crud.sh                     # 跑全部实体
#   bash e2e-data/api-crud.sh queues calendars    # 只跑指定实体
#
# 输出:
#   stdout: 实时进度(每个实体 5-7 步 PASS/FAIL)
#   $REPORT: 失败的详情 (default /tmp/api-crud-report.md)

set -u

cd "$(dirname "$0")"
source _lib/api-helpers.sh

# 初始化报告
cat > "$REPORT" <<EOF
# Phase 1 API CRUD 报告

> 生成于 $(date)
> 隔离租户: $TENANT
> BE: $API_BASE
> Backlog: docs/runbook/be-fix-backlog.md

## 失败明细

EOF

login_admin
echo "[setup] admin logged in"
echo "[setup] 测试租户: $TENANT"
echo "[setup] 报告: $REPORT"

# 生成时间戳 + 随机后缀做唯一前缀
TS=$(date +%s)
RAND=$(LC_ALL=C tr -dc 'a-z0-9' < /dev/urandom | head -c 4 || echo abcd)
PFX="e2e-${TS}-${RAND}"
echo "[setup] 测试 code 前缀: $PFX"

# 实体选择(命令行参数过滤,没传就全跑)
SELECTED=("$@")
should_run() {
  if [ ${#SELECTED[@]} -eq 0 ]; then return 0; fi
  for x in "${SELECTED[@]}"; do
    [ "$x" = "$1" ] && return 0
  done
  return 1
}

# Flags 字典:每个实体 BE 实际支持的步骤
# L=LIST C=CREATE R=READ U=UPDATE T=TOGGLE D=DELETE

# === 1. 资源队列 (LCUT, 无 GET-by-id 无 DELETE) ===
should_run queues && crud_entity \
  "资源队列" \
  "/api/console/queues" \
  "{\"tenantId\":\"$TENANT\",\"queueCode\":\"${PFX}-q1\",\"queueName\":\"[E2E] 测试队列\",\"queueType\":\"IMPORT\",\"maxRunningJobs\":10,\"maxRunningPartitions\":5,\"maxQps\":100,\"priorityPolicy\":\"FIFO\",\"fairShareWeight\":1,\"enabled\":true,\"description\":\"phase1\"}" \
  "{\"tenantId\":\"$TENANT\",\"queueName\":\"[E2E] 测试队列 updated\",\"maxRunningJobs\":20}" \
  "LCUT"

# === 2. 批次窗口 (LCUT,endStrategy: STOP|FINISH_RUNNING|CONTINUE) ===
should_run windows && crud_entity \
  "批次窗口" \
  "/api/console/batch-windows" \
  "{\"tenantId\":\"$TENANT\",\"windowCode\":\"${PFX}-w1\",\"windowName\":\"[E2E] 测试窗口\",\"timezone\":\"Asia/Shanghai\",\"startTime\":\"00:00:00\",\"endTime\":\"23:59:59\",\"endStrategy\":\"STOP\",\"outOfWindowAction\":\"WAIT\",\"allowCrossDay\":false,\"enabled\":true}" \
  "{\"tenantId\":\"$TENANT\",\"windowName\":\"[E2E] 测试窗口 updated\"}" \
  "LCUT"

# === 3. 业务日历 (LCUT,UPDATE 必带所有 @NotBlank:calendarCode/calendarName/timezone) ===
should_run calendars && crud_entity \
  "业务日历" \
  "/api/console/calendars" \
  "{\"tenantId\":\"$TENANT\",\"calendarCode\":\"${PFX}-c1\",\"calendarName\":\"[E2E] 测试日历\",\"timezone\":\"Asia/Shanghai\",\"holidayRollRule\":\"NEXT_WORKDAY\",\"catchUpPolicy\":\"AUTO\",\"catchUpMaxDays\":3,\"enabled\":true}" \
  "{\"tenantId\":\"$TENANT\",\"calendarCode\":\"${PFX}-c1\",\"calendarName\":\"[E2E] 测试日历 updated\",\"timezone\":\"Asia/Shanghai\"}" \
  "LCUT"

# === 4. 配额策略 (LCUT,UPDATE 必带 policyCode @NotBlank) ===
should_run quotas && crud_entity \
  "配额策略" \
  "/api/console/quota-policies" \
  "{\"tenantId\":\"$TENANT\",\"policyCode\":\"${PFX}-qp1\",\"maxRunningJobsPerTenant\":50,\"maxPartitionsPerTenant\":20,\"maxQpsPerTenant\":1000,\"fairShareWeight\":1,\"enabled\":true,\"description\":\"phase1\"}" \
  "{\"tenantId\":\"$TENANT\",\"policyCode\":\"${PFX}-qp1\",\"maxRunningJobsPerTenant\":100,\"fairShareWeight\":2}" \
  "LCUT"

# === 5. 告警路由 (LCUT,UPDATE 必带 alertGroup - BE 不 merge,见 BE-ISSUE-5) ===
should_run alert-routings && crud_entity \
  "告警路由" \
  "/api/console/alert-routings" \
  "{\"tenantId\":\"$TENANT\",\"routeCode\":\"${PFX}-ar1\",\"routeName\":\"[E2E] 测试路由\",\"team\":\"e2e-team\",\"alertGroup\":\"e2e-group\",\"severity\":\"WARN\",\"receiver\":\"e2e@example.com\",\"groupBy\":\"tenantId,jobCode\",\"groupWaitSeconds\":30,\"groupIntervalSeconds\":300,\"repeatIntervalSeconds\":3600,\"enabled\":true,\"description\":\"phase1\"}" \
  "{\"tenantId\":\"$TENANT\",\"routeCode\":\"${PFX}-ar1\",\"routeName\":\"[E2E] 测试路由 updated\",\"team\":\"e2e-team\",\"alertGroup\":\"e2e-group\",\"severity\":\"ERROR\",\"receiver\":\"e2e@example.com\"}" \
  "LCUT"

# === 6. 文件模板 (LCU,BE 没 toggle 接口) ===
should_run file-templates && crud_entity \
  "文件模板" \
  "/api/console/file-templates" \
  "{\"tenantId\":\"$TENANT\",\"templateCode\":\"${PFX}-ft1\",\"templateName\":\"[E2E] 测试模板\",\"templateType\":\"IMPORT\",\"fileFormatType\":\"DELIMITED\",\"version\":1,\"charset\":\"UTF-8\",\"withBom\":false,\"recordLength\":0,\"headerRows\":0,\"footerRows\":0,\"checksumType\":\"NONE\",\"compressType\":\"NONE\",\"encryptType\":\"NONE\",\"streamingEnabled\":true,\"pageSize\":1000,\"fetchSize\":1000,\"chunkSize\":500,\"previewMaskingEnabled\":false,\"errorLineMaskingEnabled\":false,\"logMaskingEnabled\":false,\"contentEncryptionEnabled\":false,\"downloadRequiresApproval\":false,\"enabled\":true,\"description\":\"phase1\"}" \
  "{\"tenantId\":\"$TENANT\",\"templateName\":\"[E2E] 测试模板 updated\"}" \
  "LCU" \
  "/api/console/queries/file-templates"

# === 7. 文件渠道 (LCRU, BE 没 toggle 接口) ===
should_run file-channels && crud_entity \
  "文件渠道" \
  "/api/console/file-channels" \
  "{\"tenantId\":\"$TENANT\",\"channelCode\":\"${PFX}-fc1\",\"channelName\":\"[E2E] 测试渠道\",\"channelType\":\"API\",\"targetEndpoint\":\"https://e2e.example.com/upload\",\"authType\":\"NONE\",\"receiptPolicy\":\"NONE\",\"configJson\":\"{}\",\"timeoutSeconds\":30,\"enabled\":true}" \
  "{\"tenantId\":\"$TENANT\",\"channelName\":\"[E2E] 测试渠道 updated\"}" \
  "LCRU" \
  "/api/console/queries/file-channels"

# === 8. Job 定义 (LCRU,jobType: GENERAL|IMPORT|EXPORT|PROCESS|DISPATCH|WORKFLOW) ===
should_run job-definitions && crud_entity \
  "Job 定义" \
  "/api/console/job-definitions" \
  "{\"tenantId\":\"$TENANT\",\"jobCode\":\"${PFX}_J1\",\"jobName\":\"[E2E] 测试 Job\",\"jobType\":\"GENERAL\",\"scheduleType\":\"MANUAL\",\"timezone\":\"Asia/Shanghai\",\"triggerMode\":\"MANUAL\",\"retryPolicy\":\"NONE\",\"retryMaxCount\":0,\"timeoutSeconds\":0,\"shardStrategy\":\"NONE\",\"executionMode\":\"FULL\"}" \
  "{\"tenantId\":\"$TENANT\",\"jobName\":\"[E2E] 测试 Job updated\"}" \
  "LCRU" \
  "/api/console/queries/job-definitions"

# === 9. Pipeline 定义 (LCRU,pipelineType: IMPORT|EXPORT|PROCESS|DISPATCH) ===
should_run pipelines && crud_entity \
  "Pipeline" \
  "/api/console/pipeline-definitions" \
  "{\"tenantId\":\"$TENANT\",\"jobCode\":\"${PFX}_J1\",\"pipelineName\":\"[E2E] 测试 Pipeline\",\"pipelineType\":\"IMPORT\",\"enabled\":true,\"description\":\"phase1\"}" \
  "{\"tenantId\":\"$TENANT\",\"jobCode\":\"${PFX}_J1\",\"pipelineName\":\"[E2E] 测试 Pipeline updated\",\"pipelineType\":\"IMPORT\"}" \
  "LCRU" \
  "/api/console/queries/pipeline-definitions"

# === 10. API Key (LC,scopes 是 String 不是 array) ===
should_run api-keys && crud_entity \
  "API Key" \
  "/api/console/api-keys" \
  "{\"keyName\":\"${PFX}-ak1\",\"scopes\":\"READ\",\"expiresAt\":\"2027-12-31T23:59:59Z\"}" \
  "{}" \
  "LC"

# === 11. Webhook (LCD,字段名 callbackUrl/eventTypes) ===
should_run webhooks && crud_entity \
  "Webhook" \
  "/api/console/webhooks" \
  "{\"name\":\"${PFX}-wh1\",\"callbackUrl\":\"https://e2e.example.com/webhook\",\"secret\":\"e2e-secret\",\"eventTypes\":[\"job.failed\"],\"enabled\":true}" \
  "{}" \
  "LCD"

# === 12. 通知渠道 (LC,channelCode 不是 channelId, configJson 字符串) ===
should_run notification-channels && crud_entity \
  "通知渠道" \
  "/api/console/notifications/channels" \
  "{\"channelCode\":\"${PFX}-nc1\",\"channelName\":\"[E2E] 测试通知渠道\",\"channelType\":\"EMAIL\",\"configJson\":\"{\\\"to\\\":\\\"e2e@example.com\\\"}\",\"enabled\":true}" \
  "{}" \
  "LC"

# === 总结 ===
echo
echo "================================================================"
echo "TOTAL: PASS $TOTAL_PASS / FAIL $TOTAL_FAIL / SKIP $TOTAL_SKIP"
echo "报告: $REPORT"
echo "================================================================"

if [ "$TOTAL_FAIL" -gt 0 ]; then
  exit 1
fi
exit 0

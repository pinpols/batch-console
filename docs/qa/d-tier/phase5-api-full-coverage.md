# API 全覆盖扫描报告

生成: Mon May 18 08:27:58 CST 2026
租户: ta
BE: http://localhost:18080

| METHOD | PATH | STATUS | NOTE |
|---|---|---|---|
| GET | `/api/console/auth/me` | 200 | OK |
| GET | `/api/console/auth/check` | 204 | OK |
| POST | `/api/console/ops/cache/evict-job-definition` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| POST | `/api/console/ops/cache/evict-all-job-definitions` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| POST | `/api/console/ops/cache/evict-workflow-definition` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| POST | `/api/console/ops/cache/evict-business-calendar` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| POST | `/api/console/ops/cache/evict-batch-window` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| POST | `/api/console/ops/cache/evict-quota-policies` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| GET | `/api/console/ops/summary` | 200 | OK |
| GET | `/api/console/ops/kafka-lag` | 200 | OK |
| GET | `/api/console/ops/outbox/stats` | 200 | OK |
| POST | `/api/console/ops/outbox/cleanup` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| POST | `/api/console/ops/outbox/republish` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| POST | `/api/console/jobs/trigger` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| POST | `/api/console/jobs/compensations` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| POST | `/api/console/jobs/compensate` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| POST | `/api/console/jobs/rerun` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| POST | `/api/console/jobs/catch-up/approve` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| POST | `/api/console/jobs/batch-days/{bizDate}/catchup` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| POST | `/api/console/forensic/export` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| GET | `/api/console/forensic/export/{exportId}/download` | 404 | expected not-found |
| POST | `/api/console/ops/batch-day-replay/sessions` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| POST | `/api/console/ops/batch-day-replay/sessions/{sessionId}/approve` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| POST | `/api/console/ops/batch-day-replay/sessions/{sessionId}/cancel` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| GET | `/api/console/ops/batch-day-replay/sessions/{sessionId}` | 200 | OK |
| GET | `/api/console/ops/batch-day-replay/sessions/{sessionId}/entries` | 200 | OK |
| GET | `/api/console/result-versions` | 400 | validation: {"code":"INVALID_ARGUMENT","message":"Required request parameter 'businessKey' f |
| GET | `/api/console/result-versions/effective` | 400 | validation: {"code":"INVALID_ARGUMENT","message":"Required request parameter 'businessKey' f |
| GET | `/api/console/result-versions/{id}` | 404 | expected not-found |
| POST | `/api/console/result-versions/{id}/reject` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| POST | `/api/console/ops/dry-run/plan` | 400 | validation: {"code":"INVALID_ARGUMENT","message":"Required request body is missing: public c |
| POST | `/api/console/batch-days/operate` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| POST | `/api/console/jobs/batch-trigger` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| GET | `/api/console/system-parameters/value` | 400 | validation: {"code":"INVALID_ARGUMENT","message":"Required request parameter 'key' for metho |
| DELETE | `/api/console/webhooks/{id}` | 400 | validation: {"code":"INVALID_ARGUMENT","message":"Required request parameter 'tenantId' for  |
| GET | `/api/console/webhooks/{id}` | 404 | expected not-found |
| PUT | `/api/console/webhooks/{id}` | 400 | validation: {"code":"INVALID_ARGUMENT","message":"Required request parameter 'tenantId' for  |
| GET | `/api/console/webhooks/delivery-logs` | 200 | OK |
| GET | `/api/console/tags/search` | 400 | validation: {"code":"INVALID_ARGUMENT","message":"Required request parameter 'tagKey' for me |
| GET | `/api/console/tags/keys` | 200 | OK |
| DELETE | `/api/console/api-keys/{id}` | 400 | validation: {"code":"INVALID_ARGUMENT","message":"Required request parameter 'tenantId' for  |
| GET | `/api/console/api-keys/{id}` | 200 | OK |
| GET | `/api/console/queries/instances/batch-status` | 400 | validation: {"code":"INVALID_ARGUMENT","message":"Required request parameter 'instanceNos' f |
| POST | `/api/console/approvals/{approvalNo}/approve` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| POST | `/api/console/approvals/{approvalNo}/reject` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| POST | `/api/console/approvals/batch-approve` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| POST | `/api/console/approvals/batch-reject` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| GET | `/api/console/config/releases` | 200 | OK |
| POST | `/api/console/config/releases/{releaseId}/rollback` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| GET | `/api/console/config/secrets` | 200 | OK |
| GET | `/api/console/config/change-logs` | 200 | OK |
| GET | `/api/console/reports/excel/config-releases` | 200 | OK |
| GET | `/api/console/reports/excel/secrets` | 200 | OK |
| GET | `/api/console/reports/excel/change-logs` | 200 | OK |
| GET | `/api/console/reports/excel/audits` | 200 | OK |
| GET | `/api/console/reports/excel/scheduler-snapshot` | 200 | OK |
| GET | `/api/console/reports/excel/scheduler-history` | 200 | OK |
| GET | `/api/console/reports/excel/workers` | 200 | OK |
| GET | `/api/console/reports/excel/outbox-retries` | 200 | OK |
| GET | `/api/console/reports/excel/outbox-deliveries` | 200 | OK |
| POST | `/api/console/workers/{workerCode}/drain` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| POST | `/api/console/workers/{workerCode}/takeover` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| GET | `/api/console/workers/{workerCode}/claimed-tasks` | 200 | OK |
| DELETE | `/api/console/files/{fileId}` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"缺少幂等键","data":null,"meta" |
| GET | `/api/console/files/{fileId}/download` | 404 | expected not-found |
| POST | `/api/console/alerts/{alertId}/ack` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| POST | `/api/console/alerts/{alertId}/silence` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| POST | `/api/console/alerts/{alertId}/close` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| GET | `/api/console/scheduler/snapshot` | 200 | OK |
| GET | `/api/console/scheduler/snapshot/history` | 200 | OK |
| GET | `/api/console/queries/audits` | 200 | OK |
| GET | `/api/console/queries/execution-logs` | 200 | OK |
| GET | `/api/console/queries/alerts` | 200 | OK |
| GET | `/api/console/queries/approvals` | 200 | OK |
| GET | `/api/console/queries/files` | 200 | OK |
| GET | `/api/console/queries/job-definitions` | 200 | OK |
| GET | `/api/console/queries/outbox-retries` | 200 | OK |
| GET | `/api/console/queries/outbox-deliveries` | 200 | OK |
| GET | `/api/console/queries/file-pipelines` | 200 | OK |
| GET | `/api/console/queries/file-pipelines/{id}` | 404 | expected not-found |
| GET | `/api/console/queries/pipeline-definitions` | 200 | OK |
| GET | `/api/console/queries/pipeline-definitions/{id}` | 404 | expected not-found |
| GET | `/api/console/file-pipeline-observability` | 200 | OK |
| GET | `/api/console/file-pipeline-observability/{id}` | 404 | expected not-found |
| GET | `/api/console/queries/file-pipeline-steps` | 200 | OK |
| GET | `/api/console/queries/file-dispatches` | 200 | OK |
| GET | `/api/console/queries/channel-receipts` | 200 | OK |
| GET | `/api/console/queries/file-channels` | 200 | OK |
| GET | `/api/console/queries/file-arrival-groups` | 200 | OK |
| GET | `/api/console/queries/file-errors` | 200 | OK |
| GET | `/api/console/queries/file-templates` | 200 | OK |
| GET | `/api/console/queries/instances` | 200 | OK |
| GET | `/api/console/queries/instances/{id}` | 404 | expected not-found |
| GET | `/api/console/queries/job-step-instances` | 200 | OK |
| GET | `/api/console/queries/job-step-instances/{id}` | 404 | expected not-found |
| GET | `/api/console/queries/partitions` | 200 | OK |
| GET | `/api/console/queries/workflow-definitions` | 200 | OK |
| GET | `/api/console/queries/workflow-nodes` | 200 | OK |
| GET | `/api/console/queries/workflow-edges` | 200 | OK |
| GET | `/api/console/queries/workflow-runs` | 200 | OK |
| GET | `/api/console/queries/workflow-runs/{id}` | 404 | expected not-found |
| GET | `/api/console/queries/workflow-node-runs` | 200 | OK |
| GET | `/api/console/queries/workflow-node-runs/{id}` | 404 | expected not-found |
| GET | `/api/console/queries/workflow-topology` | 200 | OK |
| GET | `/api/console/queries/ai-audits` | 200 | OK |
| GET | `/api/console/queries/dead-letters` | 200 | OK |
| GET | `/api/console/queries/retries` | 200 | OK |
| GET | `/api/console/queries/catch-up-approvals` | 200 | OK |
| GET | `/api/console/queries/batch-days` | 400 | validation: {"code":"VALIDATION_ERROR","message":"不能为空","data":null,"meta":{"request |
| GET | `/api/console/queries/batch-days/{bizDate}/window` | 400 | validation: {"code":"VALIDATION_ERROR","message":"不能为空","data":null,"meta":{"request |
| GET | `/api/console/queries/workers` | 200 | OK |
| GET | `/api/console/job-definitions/{id}` | 404 | expected not-found |
| PUT | `/api/console/job-definitions/{id}` | 400 | validation: {"code":"INVALID_ARGUMENT","message":"Required request body is missing: public c |
| POST | `/api/console/job-definitions/{id}/copy` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| POST | `/api/console/job-definitions/{id}/clone` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| GET | `/api/console/workflow-definitions/{id}` | 404 | expected not-found |
| PUT | `/api/console/workflow-definitions/{id}` | 400 | validation: {"code":"INVALID_ARGUMENT","message":"Required request body is missing: public c |
| POST | `/api/console/workflow-definitions/{id}/validate` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| GET | `/api/console/workflow-definitions/{id}/mermaid` | 404 | expected not-found |
| POST | `/api/console/instances/{id}/cancel` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| GET | `/api/console/ops/triggers` | 200 | OK |
| POST | `/api/console/ops/triggers/{jobCode}/register` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| POST | `/api/console/ops/triggers/{jobCode}/unregister` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| POST | `/api/console/ops/triggers/{jobCode}/pause` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| POST | `/api/console/ops/triggers/{jobCode}/resume` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| GET | `/api/console/meta/enums` | 200 | OK |
| GET | `/api/console/meta/queues` | 200 | OK |
| GET | `/api/console/meta/calendars` | 200 | OK |
| GET | `/api/console/meta/windows` | 200 | OK |
| GET | `/api/console/meta/worker-groups` | 200 | OK |
| GET | `/api/console/meta/biz-types` | 200 | OK |
| PUT | `/api/console/queues/{id}` | 400 | validation: {"code":"INVALID_ARGUMENT","message":"Required request body is missing: public c |
| POST | `/api/console/queues/{id}/toggle` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| PUT | `/api/console/batch-windows/{id}` | 400 | validation: {"code":"INVALID_ARGUMENT","message":"Required request body is missing: public c |
| POST | `/api/console/batch-windows/{id}/toggle` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| PUT | `/api/console/calendars/{id}` | 400 | validation: {"code":"INVALID_ARGUMENT","message":"Required request body is missing: public c |
| POST | `/api/console/calendars/{id}/toggle` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| GET | `/api/console/calendars/{id}/holidays` | 404 | expected not-found |
| DELETE | `/api/console/calendars/{id}/holidays/{holidayId}` | 400 | validation: {"code":"INVALID_ARGUMENT","message":"Required request parameter 'tenantId' for  |
| PUT | `/api/console/calendars/{id}/holidays/{holidayId}` | 400 | validation: {"code":"INVALID_ARGUMENT","message":"Required request body is missing: public c |
| GET | `/api/console/scheduler/status` | 200 | OK |
| POST | `/api/console/scheduler/pause-all` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| POST | `/api/console/scheduler/resume-all` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| GET | `/api/console/queries/file-channels/{channelCode}` | 404 | expected not-found |
| GET | `/api/console/queries/file-templates/{templateCode}` | 404 | expected not-found |
| GET | `/api/console/queries/files/{id}` | 404 | expected not-found |
| GET | `/api/console/config/dependencies` | 400 | validation: {"code":"INVALID_ARGUMENT","message":"Required request parameter 'configType' fo |
| GET | `/api/console/config/releases/diff` | 400 | validation: {"code":"INVALID_ARGUMENT","message":"Required request parameter 'releaseIdA' fo |
| GET | `/api/console/config/releases/{releaseId}/approval` | 404 | expected not-found |
| POST | `/api/console/config/approvals/{approvalId}/approve` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| POST | `/api/console/config/approvals/{approvalId}/reject` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| POST | `/api/console/config/sync/export` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| POST | `/api/console/config/sync/preview` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| GET | `/api/console/config/sync/logs` | 200 | OK |
| GET | `/api/console/config/releases/{releaseId}` | 404 | expected not-found |
| GET | `/api/console/config/secrets/{secretVersionId}` | 404 | expected not-found |
| PUT | `/api/console/quota-policies/{id}` | 400 | validation: {"code":"INVALID_ARGUMENT","message":"Required request body is missing: public c |
| POST | `/api/console/quota-policies/{id}/toggle` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| PUT | `/api/console/alert-routings/{id}` | 400 | validation: {"code":"INVALID_ARGUMENT","message":"Required request body is missing: public c |
| POST | `/api/console/alert-routings/{id}/toggle` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| GET | `/api/console/pipeline-definitions/{id}` | 404 | expected not-found |
| PUT | `/api/console/pipeline-definitions/{id}` | 400 | validation: {"code":"INVALID_ARGUMENT","message":"Required request body is missing: public c |
| POST | `/api/console/pipeline-definitions/{id}/toggle` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| POST | `/api/console/instances/partitions/{id}/cancel` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| POST | `/api/console/workflow-runs/{id}/cancel` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| POST | `/api/console/workflow-runs/{id}/terminate` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| POST | `/api/console/workflow-runs/{id}/skip-node` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| GET | `/api/console/dashboard/job-stats` | 200 | OK |
| GET | `/api/console/dashboard/trigger-stats` | 200 | OK |
| GET | `/api/console/dashboard/worker-load` | 200 | OK |
| GET | `/api/console/dashboard/alert-trend` | 200 | OK |
| GET | `/api/console/dashboard/sla-compliance` | 200 | OK |
| GET | `/api/console/dashboard/sla-report` | 200 | OK |
| GET | `/api/console/dashboard/execution-progress` | 400 | validation: {"code":"INVALID_ARGUMENT","message":"Required request parameter 'jobCode' for m |
| GET | `/api/console/dashboard/tenant-usage` | 200 | OK |
| GET | `/api/console/file-channels/{id}` | 404 | expected not-found |
| PUT | `/api/console/file-channels/{id}` | 400 | validation: {"code":"INVALID_ARGUMENT","message":"Required request body is missing: public c |
| GET | `/api/console/file-templates/{id}` | 404 | expected not-found |
| PUT | `/api/console/file-templates/{id}` | 400 | validation: {"code":"INVALID_ARGUMENT","message":"Required request body is missing: public c |
| POST | `/api/console/config/tenant-init` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| POST | `/api/console/config/tenant-copy` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| GET | `/api/console/ops/governance` | 200 | OK |
| POST | `/api/console/ops/governance/reset` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| GET | `/api/console/ops/archive-policies` | 200 | OK |
| GET | `/api/console/ops/cluster-diagnostic` | 200 | OK |
| GET | `/api/console/ops/cluster-diagnostic/shedlock` | 200 | OK |
| GET | `/api/console/ops/cluster-diagnostic/workers` | 200 | OK |
| GET | `/api/console/ops/cluster-diagnostic/outbox` | 200 | OK |
| GET | `/api/console/ops/cluster-diagnostic/terminal-children` | 200 | OK |
| GET | `/api/console/tenants` | 200 | OK |
| GET | `/api/console/tenants/{tenantId}` | 200 | OK |
| PUT | `/api/console/tenants/{tenantId}` | 400 | validation: {"code":"INVALID_ARGUMENT","message":"Required request body is missing: public c |
| GET | `/api/console/users` | 200 | OK |
| GET | `/api/console/users/{id}` | 200 | OK |
| PUT | `/api/console/users/{id}` | 400 | validation: {"code":"INVALID_ARGUMENT","message":"Required request body is missing: public c |
| POST | `/api/console/users/{id}/reset-password` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| GET | `/api/console/tenants/quota` | 200 | OK |
| GET | `/api/console/tenants/usage` | 200 | OK |
| POST | `/api/console/self-service/jobs/rerun-request` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| GET | `/api/console/event-catalog/event-types` | 200 | OK |
| GET | `/api/console/event-catalog/topics` | 200 | OK |
| POST | `/api/console/workers/{workerCode}/warmup` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| GET | `/api/console/files/{fileId}/errors/export` | 200 | OK |
| DELETE | `/api/console/notifications/channels/{channelCode}` | 400 | validation: {"code":"INVALID_ARGUMENT","message":"Required request parameter 'tenantId' for  |
| GET | `/api/console/notifications/channels/{channelCode}` | 404 | expected not-found |
| PUT | `/api/console/notifications/channels/{channelCode}` | 400 | validation: {"code":"INVALID_ARGUMENT","message":"Required request parameter 'tenantId' for  |
| POST | `/api/console/notifications/channels/{channelCode}/test` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| DELETE | `/api/console/notifications/rules/{ruleId}` | 400 | validation: {"code":"INVALID_ARGUMENT","message":"Required request parameter 'tenantId' for  |
| GET | `/api/console/notifications/rules/{ruleId}` | 404 | expected not-found |
| PUT | `/api/console/notifications/rules/{ruleId}` | 400 | validation: {"code":"INVALID_ARGUMENT","message":"Required request parameter 'tenantId' for  |
| GET | `/api/console/notifications/delivery-logs` | 200 | OK |
| GET | `/api/console/config/tenant-package/excel/export` | 200 | OK |
| GET | `/api/console/config/tenant-package/excel/template` | 200 | OK |
| POST | `/api/console/config/tenant-package/excel/upload` | 400 | validation: {"code":"INVALID_ARGUMENT","message":"Content-Type 'application/json' is not sup |
| GET | `/api/console/config/tenant-package/excel/preview/{uploadToken}` | 404 | expected not-found |
| GET | `/api/console/config/tenant-package/excel/preview/{uploadToken}/workbook` | 404 | expected not-found |
| POST | `/api/console/config/tenant-package/excel/apply/{uploadToken}` | 400 | validation: {"code":"MISSING_IDEMPOTENCY_KEY","message":"this endpoint requires Idempotency- |
| GET | `/api/console/push/vapid-public-key` | 404 | expected not-found |

## 统计

- PASS: **218**
- FAIL (5xx/timeout): **0**
- SKIP (SSE/AI/PUT/DELETE-bulk/api-crud 已覆盖/write-needs-payload): **86**


# 测试数据核验报告

时间:2026-05-11
范围:对 `e2e-data/` 所有测试数据做"语法 + 接口契约 + DB schema"3 层核验。

## 总结

| 层 | 通过 | 修复 | 跳过 |
|---|---|---|---|
| 文件结构 / JSON 解析 / Excel 可打开 / SQL 事务 | 45 | 0 | 0 |
| Payload 字段 vs FE TypeScript 类型 | 4 | **10** | 1(user-create 接口不存在) |
| SQL 字段 vs BE migration schema | 0 | **3**(全部重写) | 0 |
| Excel 异常变异生效 | 3 | 0 | 0 |

## 修复明细

### 🔴 SQL seed(全部重写,旧版字段全错)

| 文件 | 原错误 | 修正 |
|---|---|---|
| `03-job-instance-states/seed-job-instances.sql` | 表写 `job_instance` 缺 schema、字段 `status` 实为 `instance_status`、用了不存在的 `BLOCKED/SUCCEEDED` 枚举、写了不存在的 `error_message`/`blocked_reason` 字段、子表 `partition_instance` 实为 `job_partition` | 改用 `batch.job_instance` schema、字段对齐 `instance_status`/`dedup_key`(NOT NULL)/`job_definition_id` FK,枚举使用 `RUNNING/SUCCESS/FAILED/CANCELLED`,子表用 `batch.job_partition` |
| `04-approvals-pending/seed-pending-approvals.sql` | 表 `console_approval` 实为 `batch.approval_command`,枚举 `JOB_DEFINITION_CHANGE` 不存在 | 改用 `batch.approval_command`,枚举只支持 `CATCH_UP/COMPENSATION/DLQ_REPLAY/DOWNLOAD`,补 `action_type`/`payload_json`/`source_trace_id` 字段 |
| `07-outbox-stuck/seed-outbox-stuck.sql` | `event_id` 实为 `event_key`、`status` 实为 `publish_status`、`retry_count` 实为 `publish_attempt`、`payload` 实为 `payload_json`、`STUCK` 枚举不存在 | 全部字段重命名,状态用 `FAILED`/`GIVE_UP`(BE 没有 STUCK) |

### 🟡 Payload schema 错位修复

| 文件 | 原字段 | 实际 FE 类型 |
|---|---|---|
| `08-system-level/payloads/webhook-create.json` | `url`, `description` | `callbackUrl`(对齐 `CreateWebhookBody`),去掉 `description` |
| `08-system-level/payloads/api-key-create.json` | `name`, `scopes: []`, `description` | `keyName`, `scopes`(**string CSV** 非数组), `expiresAt` |
| `08-system-level/payloads/notification-channel-email.json` | `config: {...}` 嵌套 | `config: "..."` 是 JSON **字符串** |
| `08-system-level/payloads/notification-channel-feishu.json` | 同上 | 同上 |
| `08-system-level/payloads/notification-rule-job-failed.json` | `eventType` / `channelCodes` 数组 / `conditions` 嵌套 | `eventTypes`(CSV string) / `channelId`(number) |
| `08-system-level/payloads/tag-batch-create.json` | `tagKey/tagValue` 仅 | 补 `resourceType`/`resourceCode`(标签作用对象) |
| `08-system-level/payloads/system-parameter-update.json` | `paramKey/paramValue` | `key`/`value` |
| `08-system-level/payloads/archive-policy-update.json` | `policies: []` 数组 | **单条** `{ targetTable, retentionDays, archiveEnabled, cleanupEnabled, batchSize }` |
| `09-self-service/payloads/rerun-request.json` | `priority` 字段 | `tenantId`/`targetInstanceNo`(原 `targetInstanceIds: []` 错) |
| `09-self-service/payloads/compensation-request.json` | `compensationType: RANGE` + `rangeStart/End` | `compensationType: FULL_RERUN` + `targetInstanceNo`(无 range 字段) |
| `09-self-service/payloads/quota-request.json` | `category/currentLimit/requestedLimit` | `field/requestedValue/reason` |
| `06-file-pipeline/payloads/file-redispatch.json` | `fileIds: [array]` | **单条** `fileId: number` |
| `06-file-pipeline/payloads/file-archive.json` | `fileIds: []` + `retainDays` | **单条** `fileId: number` |
| `06-file-pipeline/payloads/arrival-group-action.json` | `groupId` / 自定义 action | `fileGroupCode` / 枚举 `CONFIRM/REDISPATCH/RESET/IGNORE` |
| `05-config-release-flow/payloads/release-create.json` | `configKey`/`description`/`changes: [...]` | `configCode`/`releaseNote`(BE schema 是 release 元数据,不含 changes) |
| `05-config-release-flow/payloads/release-{submit-approval,gray,publish,rollback}.json` | `reason`/`approvers`/`scope`/`rollbackToVersion` 等 | 统一为 `{ tenantId, operatorId?, reason?, traceId? }` 模式;gray 额外用 `grayScopeJson` (string) |

### 🟠 接口不存在的功能

`POST /api/console/users` 在 **BE openapi 和 FE 都没暴露**(只有 GET/PUT/enable/disable/reset)。

| 处理 |
|---|
| **删除** `10-rbac-users/seed-users.sh` 调 API 逻辑,改为提示器输出 SQL 方案 |
| **新增** `10-rbac-users/seed-users.sql` — 直接 INSERT batch.console_user_account 表,5 个用户,密码 hash 留占位待 BE PasswordEncoder 生成 |
| `08-system-level/payloads/user-create.json` 加 `_unsupported: true` 标记,字段名对齐 SQL 列(`tenant_id`/`authorities_csv` 等) |

### ✓ 不变(本就正确)

- 00-tenant-lifecycle 全部 5 payloads(`single-create.json` 等)字段名对齐 `src/api/tenants.ts` 接口
- 02-excel-edge-cases 3 份异常 Excel(变异生效:缺列 / 非法 enum / 5500 行)
- 06-file-pipeline samples(csv / 空 / UTF-16)

## 已确认的 schema 来源(免回头扯皮)

| BE 表/接口 | 真实来源 |
|---|---|
| `batch.job_instance` | `file-batch-system/db/migration/V5__create_runtime_tables.sql` |
| `batch.job_partition` | 同上 |
| `batch.approval_command` | `V27__approval_command.sql` |
| `batch.config_approval` | `V49__create_notification_approval_config_sync.sql` |
| `batch.outbox_event` | `V7__create_ops_tables.sql` |
| `batch.console_user_account` | `V34__create_console_user_account.sql` |
| FE webhook body | `src/api/webhooks.ts:CreateWebhookBody` |
| FE api-key body | `src/api/apiKeys.ts:createApiKey()` |
| FE notification channel form | `src/views/system/components/NotificationChannelsTab.vue:channelForm` |
| FE notification rule form | `src/views/system/components/NotificationRulesTab.vue:ruleForm` |
| FE tags body | `src/api/tags.ts:upsertResourceTag()` |
| FE system param body | `src/api/systemParameters.ts` |
| FE archive policy body | `src/api/ops.ts:upsertArchivePolicy()` |
| FE file ops body | `src/api/file.ts` |
| FE config release body | `src/api/configReleases.ts` |
| FE self-service body | `src/api/selfServiceJobs.ts`, `src/api/tenantSelfService.ts` |

## 仍待人工修复

1. **`10-rbac-users/seed-users.sql` 5 处密码 hash 占位**:需要 BE 同事用 `PasswordEncoder`(Argon2id)生成真 hash 替换
2. **`03/04/07` SQL 执行前置**:确认 ta 租户已有 `job_code='TA_INC_ORDER_AGG'` 的 job_definition,否则 03 INSERT 时 FK 报错

## 跑通核验

```bash
cd batch-console/e2e-data
./verify-data.sh
# 期待:✓ 45  ⚠ 0  ✗ 0
```

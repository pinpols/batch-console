# Phase 6 — 真实业务流程端到端

> 生成: 2026-05-18
> 范围: SQL seed 完整运行时数据 → playwright 跑 9 个跨页业务流程 → watchdog 兜底 0 4xx/5xx
> spec: [e2e/business-flows.spec.ts](../../../e2e/business-flows.spec.ts)

## 结果

```
9 passed / 0 failed / 1 skipped   (36.9 秒)
全程 watchdog 报 0 个非预期 4xx/5xx
```

## 9 段业务流程

| # | 流程 | 涉及功能 | 数据来源 | 结果 |
|---|---|---|---|---|
| 1 | Job 实例 — 列表加载 + 取消 RUNNING + 详情 | `/monitor/job-instances` 列表/详情/cancel | 28 条 seed instance(含 RUNNING) | ✅ |
| 2a | 审批 — approve 第一条 | `/approvals` + POST approve | 3 条 PENDING approval | ✅ |
| 2b | 审批 — reject | `/approvals` + POST reject | 同上 | ✅ |
| 3 | Outbox — 列表 + 重发布 | `/observability/outbox` + republish | 3 条 FAILED outbox + 3 条 retry | ✅ |
| 4 | Alert — ack / silence / close 三流程 | `/observability/alerts` 行操作 | 4 条 OPEN alert | ✅ |
| 5 | Config release — diff / publish 行操作 | `/config/releases` | 3 条(DRAFT/PENDING/PUBLISHED) | ✅ |
| 6 | Tenant copy config — 试运行 | `/system/tenants` 复制配置 dialog | 11 条 e2e- 测试租户 | ✅ |
| 7 | JobDefinition — clone | `/jobs/definitions` 克隆 | 4 条 ta job def | ✅ |
| 8 | File — 归档 + 审计行操作 | `/files/list` | 6 条 file | ⏭ skip(无可归档文件) |
| 9 | 自助服务 — 配额变更提交流程(不实际提交) | `/self-service` 卡片→drawer | 静态 UI | ✅ |

## 实施前置条件

### 数据 seed(P5b 已完成)

```sql
-- ta 租户运行时数据
job_instance:           28 (含 RUNNING / SUCCESS / FAILED / CANCELLED)
job_partition:          25
approval_command:        3 PENDING
outbox_event:            3 FAILED + 448 PUBLISHED
event_outbox_retry:      3 FAILED
alert_event:             4 OPEN
config_release:          3 (DRAFT/PENDING_APPROVAL/PUBLISHED)
```

### BE 修复(P5/P5b 已完成)

1. `ConsoleApiExceptionHandler` 加 `HttpMediaTypeNotSupportedException` / `MultipartException` / `MissingServletRequestPartException` → 400 handler(原 500)
2. `FileTemplateUpdateRequest` 加 `loadTargetRef` / `exportDataRef` 字段
3. `ReplicaLagMonitor` 加 lag-aware quarantine(streaming replica = 0 或 lag > 30s 触发)
4. orchestrator 重新 build(修 NoClassDefFoundError on CompensationCommandStatus)
5. file_template_config 8 行直接 SQL 补 `load_target_ref='jdbc_mapped'` / `export_data_ref='sql_template_export'`
6. console-api `.env.local` 加 `BATCH_CONSOLE_READ_REPLICA_ENABLED=false`(规避 dev 主从断流)

### 链路验证(操作真生效)

| 操作 | API | DB 变化 |
|---|---|---|
| 实例 cancel RUNNING | POST `/instances/{id}/cancel` | 409 STATE_CONFLICT(业务规则,RUNNING 不能直接 cancel)|
| 实例 terminate RUNNING | POST `/instances/{id}/terminate` | RUNNING → **TERMINATED** ✓ |
| 实例 rerun FAILED | POST `/jobs/rerun` | 生成 compensation cmd ✓ |
| 分片 retry FAILED | POST `/instances/partitions/{id}/retry` | FAILED → **RETRYING** ✓ |
| 分片 cancel READY | POST `/instances/partitions/{id}/cancel` | READY → **CANCELLED** ✓ |

链路 **FE → console BE → orchestrator → DB CAS** 全程通,非 UI 仪表展示。

## Watchdog 网络日志分类

```
P6 全程 0 个非预期 4xx/5xx
```

P6 期间 36.9 秒,9 个 spec 全部 `network.assertClean()` 通过,**无任何 network.log 落盘**。

## 与 Goal 对照

| 目标条件 | 验证 |
|---|---|
| 真实场景不会报错 4xx/5xx | ✅ 9 段业务流程 watchdog 全程 0 真实后端 5xx |
| 业务真闭环(不只是 UI 展示) | ✅ DB CAS 实测改状态;cancel/terminate/retry 真生效 |
| 不依赖 worker 在线 | ✅ SQL seed 完整状态 + 操作直接走 orchestrator,跳过 worker 消费链 |
| 覆盖运维操作 | ✅ approve/reject/cancel/terminate/retry/republish/ack/silence/close/diff/publish/clone/copy-config/submit-quota-change |

## 已知局限

- **8. File 归档**:ta 租户的 6 条文件状态都不是「可归档」,spec 已写 conditional skip。后续可补 SQL seed 把 1 条文件状态调成「已完成可归档」
- **worker 不在线**:Path A 已经放弃修(JVM 25 + Kafka 兼容问题不可控),不影响业务操作链路本身,仅影响「触发后实例从 PENDING → RUNNING → SUCCEEDED」的真消费链。本测试用 seed 数据覆盖了所有终态,不需 worker
- **outbox-deliveries 历史残留**:有 448 条 PUBLISHED + 3 条 FAILED,不影响测试,P3 cleanup-soft 可清(脚本另有已知 bug,P5b 报告中标过)

## 阶段索引

| Phase | 关键产出 |
|---|---|
| [P1](phase1-api-crud-stdout.log) + [边界](phase1-boundary.md) + [RBAC](phase1-rbac.md) | API 62 调用 + 边界 25 + RBAC 6 角色全绿 |
| [P2 UI](phase2-ui-summary.md) | 511 spec 4 轮迭代到 0 fail |
| [P3 跨页闭环](phase3-journey.md) | 9 段用户行为闭环 0 4xx/5xx |
| [P4 mobile real-BE](phase4-mobile-real-be.md) | 13 mobile spec real-BE 通过 |
| [P5 API 全覆盖](phase5-api-full-coverage.md) | 218/302 endpoint 真扫描,0 真 5xx |
| [P5 最终总评](phase5-final-summary.md) | 867/0 真闭环 + 2 个 BE 真问题修复 |
| [P5b 主从复制](phase5b-replication-fix.md) | dev disable + prod 4 alert + BE lag-aware |
| **P6 业务流程**(本文件) | **9/0 真业务操作 0 真 5xx,DB CAS 真生效** |

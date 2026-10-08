# 主从复制断流分析 + 监控/兜底改进

> 触发:2026-05-18 e2e seed 数据后 FE 仍看 0,排查发现 PG 从库已断主库 11 天
> 范围:dev 环境止血 + prod 监控规则 + BE lag-aware 兜底

## 现状(已修)

| 维度 | 状态 |
|---|---|
| `pg_stat_replication` (主库) | 0 行 = 无任何 active replica |
| `pg_last_xact_replay_timestamp()` (从库) | replay_lag = 10 天 23 小时(停在 2026-05-07) |
| BE 兜底 | ❌ 旧 circuit breaker 只检测 SQLException,识别不出「连得上但 stale」 |
| Prometheus 告警 | ❌ postgres-exporter 在采指标但无 alert rule |

## 根因

代码层:**没 bug**。是「dev env 无人监控 + BE 容错只识别连接失败」复合故障。

可能的 PG 触发顺序:
1. 主库被 docker-compose down/up 过 → WAL 段被清
2. 或主库重启时 replication slot 没保留(default 不持久)
3. 从库 reconnect 时 recovery position 落到主库已清理的 WAL → 永久卡

## 已落地的 3 个改动

### 1. Dev 环境止血(已生效)

`../file-batch-system/.env.local`:
```bash
BATCH_CONSOLE_READ_REPLICA_ENABLED=false   # 让 BE 只读主库,seed 数据立刻可见
```

`bash scripts/local/restart.sh console` 后验证:
```
queries/instances:        28 ✅
queries/approvals:         3 ✅
queries/alerts:            4 ✅
queries/outbox-retries:    3 ✅
```

### 2. Prod Prometheus 告警(4 条新规则)

`../file-batch-system/docker/observability/prometheus-batch-rules.yml` 末尾追加:

| Alert | 触发条件 | severity | 处置 |
|---|---|---|---|
| `PostgresReplicationStopped` | `pg_stat_replication_count == 0` for 1m | **critical** | 主库无任何 replica 连接 → 立刻查 docker logs + 重建从库 |
| `PostgresReplicationLagHigh` | `pg_replication_lag > 30s` for 5m | warning | BE 应自动 quarantine(已配)+ 排查从库 IO |
| `PostgresReplicationLagCritical` | `pg_replication_lag > 300s` for 1m | **critical** | 业务读到 5min 前数据,立刻切主库读 |
| `PostgresReplicationSlotInactive` | `pg_replication_slots_active == 0` for 5m | warning | Slot 在但无连接,主库 WAL 堆积 → 必要时 drop slot |

prometheus-exporter 已在 `docker-compose.observability.yml` 起着(`prometheuscommunity/postgres-exporter:v0.16.0`),v0.16+ 默认开 `pg_replication_lag` 和 `pg_replication_slots` collectors。规则一加即生效。

### 3. BE Lag-Aware Circuit Breaker

旧 `ReadReplicaRoutingDataSource` 只看 `SQLException`,**识别不出「连得上但 stale」**。本次扩:

- **`ReadReplicaRoutingDataSource.markQuarantined(reason)`** — 新增 public 入口,允许外部触发器进入 quarantine
- **`ReplicaLagMonitor`** 已存在的定时采样器(30s 一次)增强:
  - 同时取 `MAX(replay_lag)` 和 `streaming replica COUNT(*)`
  - `replica_count == 0` → `markQuarantined("no_streaming_replicas")`
  - `replay_lag > lagThresholdSeconds`(默认 30s)→ `markQuarantined("lag_exceeded")`
- **`ReadReplicaProperties.lagThresholdSeconds`** = 30s (可调,0 禁用)
- 新 Prometheus gauge `batch.console.replica.streaming_count`(辅助看从库数量)
- 新 counter tag `failover.count{reason="lag_exceeded"}` 和 `reason="no_streaming_replicas"`

**改动文件**(都已 `mvn compile` 通过):
```
batch-console-api/src/main/java/com/example/batch/console/config/
  ├─ ReadReplicaProperties.java         (+ lagThresholdSeconds 字段)
  ├─ ReadReplicaRoutingDataSource.java  (+ markQuarantined() public)
  ├─ ReplicaLagMonitor.java             (+ enableLagAwareQuarantine wire-up + replica_count 采样 + 自动 quarantine 调用)
  └─ ReadReplicaDataSourceConfiguration.java (wire lagMonitor → routing)
```

## 验证路径(上线后)

1. Prometheus UI 检查新 4 条 rule load 成功(`/rules` 页)
2. 故意停从库 → 5min 内应触发 `PostgresReplicationStopped` + BE 日志出现 `replica externally quarantined for 30000ms (reason=no_streaming_replicas)`
3. 大事务造成 lag > 30s → 触发 `PostgresReplicationLagHigh` + BE 日志 `reason=lag_exceeded`
4. 恢复从库 → BE 日志 `replica recovered after quarantine`

## 与 D 档 P5 主报告关系

本文件是 [phase5-final-summary.md](phase5-final-summary.md) 的补丁子项,记录 P5.B+E 阶段为造 seed 数据发现并解决的环境问题。

# 03 — JobInstance 状态机

## 测的接口
- POST `/api/console/instances/{id}/cancel`
- POST `/api/console/instances/{id}/terminate`
- POST `/api/console/instances/partitions/{partitionId}/cancel`
- POST `/api/console/instances/partitions/{partitionId}/retry`
- POST `/api/console/jobs/rerun`
- POST `/api/console/jobs/trigger`
- POST `/api/console/self-service/jobs/rerun-request`
- POST `/api/console/self-service/jobs/compensation-request`

## 需要的状态(每租户至少一份)
- 1 × **RUNNING** instance(测 cancel / terminate)
- 1 × **SUCCEEDED** instance(测 rerun-request / compensation-request)
- 1 × **FAILED** instance + 1 × FAILED partition(测 partition retry)
- 1 × **BLOCKED** instance(测人工解锁)

## 怎么造

### 方式 A:trigger 真跑(推荐 — 接近真实)
```bash
# 用 admin 登录 + X-Tenant-Id: ta,触发某 jobCode
./trigger-job.sh ta jobCode_a1
# 等几秒看 instance 列表
```
脚本待写在 `trigger-and-wait.sh`。

### 方式 B:BE SQL 种子(快但需找 BE 同事)
```sql
-- TBD: 让 BE 出 seed-job-instances.sql
INSERT INTO job_instance (...) VALUES (RUNNING_sample), (SUCCEED_sample), (FAILED_sample);
INSERT INTO partition_instance (...) VALUES (FAILED_partition);
```

## FE 触发路径
- `/monitor/job-instances` — 列表行操作
- `/monitor/job-instances/:id` — 详情页按钮
- `/monitor/job-instances/:id/partitions` — 分片操作
- `/self-service` — 自助申请补/重跑

# Boundary 边界值测试报告

> 生成: Sun May 17 22:09:38 CST 2026
> 隔离租户: tx

| Endpoint | 字段 | 用例 | 期望 | 实际 | 状态 |
|---|---|---|---|---|---|
| /api/console/alert-routings | routeCode | len=max+1 | 400 | 400 | ✓ |
| /api/console/alert-routings | team | len=max+1 | 400 | 400 | ✓ |
| /api/console/alert-routings | alertGroup | len=max+1 | 400 | 400 | ✓ |
| /api/console/alert-routings | severity | invalid-enum | 400 | 400 | ✓ |
| /api/console/alert-routings | receiver | len=max+1 | 400 | 400 | ✓ |
| /api/console/alert-routings | groupWaitSeconds | overflow | 400 | 400 | ✓ |
| /api/console/alert-routings | groupWaitSeconds | negative-1 | 400 | 400 | ✓ |
| /api/console/queues | queueCode | len=max+1 | 400 | 400 | ✓ |
| /api/console/queues | queueName | len=max+1 | 400 | 400 | ✓ |
| /api/console/queues | queueType | invalid-enum | 400 | 400 | ✓ |
| /api/console/queues | maxRunningJobs | overflow | 400 | 400 | ✓ |
| /api/console/queues | maxRunningJobs | negative-1 | 400 | 400 | ✓ |
| /api/console/queues | maxRunningPartitions | overflow | 400 | 400 | ✓ |
| /api/console/queues | maxRunningPartitions | negative-1 | 400 | 400 | ✓ |
| /api/console/queues | maxQps | overflow | 400 | 400 | ✓ |
| /api/console/queues | maxQps | negative-1 | 400 | 400 | ✓ |
| /api/console/quota-policies | policyCode | len=max+1 | 400 | 400 | ✓ |
| /api/console/quota-policies | maxRunningJobsPerTenant | overflow | 400 | 400 | ✓ |
| /api/console/quota-policies | maxRunningJobsPerTenant | negative-1 | 400 | 400 | ✓ |
| /api/console/quota-policies | maxPartitionsPerTenant | overflow | 400 | 400 | ✓ |
| /api/console/quota-policies | maxPartitionsPerTenant | negative-1 | 400 | 400 | ✓ |
| /api/console/quota-policies | maxQpsPerTenant | overflow | 400 | 400 | ✓ |
| /api/console/quota-policies | maxQpsPerTenant | negative-1 | 400 | 400 | ✓ |
| /api/console/quota-policies | fairShareWeight | overflow | 400 | 400 | ✓ |
| /api/console/quota-policies | fairShareWeight | negative-1 | 400 | 400 | ✓ |

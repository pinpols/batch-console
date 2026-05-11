# 09 — 自助服务

## 测的接口
- POST `/api/console/self-service/jobs/rerun-request`
- POST `/api/console/self-service/jobs/compensation-request`
- POST `/api/console/tenants/quota/request`

## 前置依赖
需要 03-job-instance-states 里至少:
- 1 × SUCCEED(测 rerun-request)
- 1 × FAILED(测 compensation-request)

## payload 样本(待补)
- `rerun-request.json` — 指定 jobCode + bizDate
- `compensation-request.json` — 指定 instanceId + 补偿原因
- `quota-request.json` — 配额申请

## FE 触发路径
**自助服务** `/self-service`(普通租户用户也能进)

## 用户
建议用 OPERATOR 角色测,看权限网关是否正确放行。

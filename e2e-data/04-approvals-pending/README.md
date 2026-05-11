# 04 — 待审批数据

## 测的接口
- POST `/api/console/approvals/{approvalNo}/approve`
- POST `/api/console/approvals/{approvalNo}/reject`
- POST `/api/console/config/approvals/{approvalId}/approve`
- POST `/api/console/config/approvals/{approvalId}/reject`

## 状态需求
**每租户**至少:
- 1 条 **通用** PENDING(jobDef 改动提审)
- 1 条 **Catch-up** PENDING(在某 batchDay 发起 catch-up)
- 1 条 **配置发布** PENDING(ConfigRelease.submit-approval)→ 在 05- 流程里造

## 怎么造

### 通用 approval(改 jobDef → 提审)
登录 OPERATOR 用户在 `/jobs/definitions`:
1. 编辑某 jobDef → 改 cron
2. 保存 → 走"提交审批"按钮(若 BE 配了 approval 网关)
3. 系统会留下 1 条 PENDING

或直接 API:
```bash
# TBD: ./create-pending-approval.sh ta
```

### Catch-up approval
`/scheduler/batch-days/:bizDate` → 发起 catch-up → 审批中心可见。

## FE 触发路径
**审批中心** `/approvals?tab=general` / `/approvals?tab=catch-up`

## 验证点
- 行内 approve / reject 按钮(单条)
- 顶部"批量通过 / 批量拒绝"(选中 N 条)
- approve 后状态切到 APPROVED 并消失出 PENDING tab

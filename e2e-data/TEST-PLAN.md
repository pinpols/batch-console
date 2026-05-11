# 前端写接口测试计划 — 最终交付

## 总体覆盖

| 维度 | 数量 |
|---|---|
| Playwright spec 文件 | **46**(原 41 + 新 5) |
| 总 test cases | ~402(原 388 + 14 新) |
| 通过率 | **96%+**(隔离单 worker 100%;并行偶发 flaky) |
| 已知跳过(BE bug) | 2(workflow toggle/详情 404) |
| 已知跳过(覆盖在单测) | 1(rbac 5xx 路由守卫,见 interceptors.integration.test.ts) |

## 已覆盖的写接口模块

| 模块 | 关键接口 | spec | 状态 |
|---|---|---|---|
| 租户生命周期 | POST /tenants(单/批)、suspend/activate、tenant-init/copy | tenant-ops, tenant-config-ops | ✓ |
| JobDefinition | POST/PUT/PATCH、clone/copy/batch toggle | job-ops, job-workflow | ✓ |
| PipelineDefinition | POST/PUT/DELETE、toggle | job-ops | ✓ |
| WorkflowDefinition | POST、PUT、validate | job-workflow | ✓(toggle/detail BE 404 skip) |
| JobInstance | cancel/terminate/partition retry | monitor-ops (19 tests) | ✓ |
| 自助服务 | rerun/compensation/quota request | self-service-forms, self-service | ✓ |
| 审批 | approve/reject(通用 + Catch-up + 配置) | approval-actions, approval-ops | ✓ |
| 配置发布 | submit-approval/gray/publish/rollback | config-release-ops, config-release-advanced | ✓ |
| **配置同步** | export/import/preview | **新增 config-sync.spec.ts** | ✓ |
| Excel 导入 | tenant-package upload、各 domain CRUD | excel-import (14 tests) | ✓ |
| 文件流 | redispatch/archive/confirm-arrival/arrival-group | file-ops | ✓ |
| Worker | warmup、CRUD、Drain/接管 | worker-management, worker-ops | ✓ |
| Trigger | pause/resume/register/触发 | trigger-ops, scheduler-governance-ops | ✓ |
| APIKey | POST/DELETE/rotate | api-key-crud | ✓(支持明文 secret modal) |
| Notification(channel/rule) | POST/PUT/DELETE | notification-crud, notification-management | ✓ |
| **Webhook 独立** | POST/PUT/DELETE | **新增 webhook-crud.spec.ts** | ✓ |
| Tag | POST/DELETE 单/全 | tag-management-crud, tag-ops | ✓ |
| SystemParameter | PUT/DELETE | system-parameter-crud | ✓ |
| User | POST/PUT/DELETE/enable/disable/reset | user-account-ops | ✓ |
| **AI Chat** | POST /ai/chat | **新增 ai-chat.spec.ts** | ✓ |
| Outbox | republish/cleanup | alert-outbox-ops | ✓ |
| 运维 | governance/archive-policies/diagnostic | governance, ops-diagnostic-ops | ✓ |
| Scheduler 治理 | batch-window/calendar/queue/quota toggle、holiday CRUD | scheduler-governance-ops (23 tests) | ✓ |
| **RBAC 拒绝** | 401/refresh-fail/5xx 路径 | **新增 rbac-denial.spec.ts** | ✓(5xx 跳 unit) |
| **错误韧性** | 404/5xx/网络中断/ErrorBoundary | **新增 error-recovery.spec.ts** | ✓ |

## 测试数据全清单(`e2e-data/` 已纳入 git 管理)

```
batch-console/e2e-data/
├── README.md
├── TEST-PLAN.md                         ← 本文件
├── EXEC-MATRIX.md                       ← 执行顺序 / 互斥 / 清理矩阵
├── _lib/
│   └── auth.sh                          ← 公共 admin token 工具
├── cleanup-soft.sh                      ← A 档:删本测试会话产生的实例/审批
├── cleanup-config.sh                    ← B 档:Excel 包重导回 baseline
├── cleanup-hard.sh                      ← C 档:删临时租户 + 测试系统级实体
│
├── 00-tenant-lifecycle/                 ✓ 数据 ✓ 脚本 ✓
│   ├── README.md
│   ├── seed-tenants.sh                  ← 一键造 td/te/tf/tg/th
│   └── payloads/
│       ├── single-create.json
│       ├── batch-create.json
│       ├── batch-init.json
│       ├── tenant-copy.json
│       └── quota-request.json
│
├── 01-tenant-config-import/             ✓ ta/tb/tc Excel 整包(symlink)
│
├── 02-excel-edge-cases/                 ✓ 3 份异常 Excel
│   ├── README.md
│   ├── generate.py                      ← Python 脚本派生
│   ├── bad-missing-required-col.xlsx    ← 缺 job_code 列
│   ├── bad-invalid-enum.xlsx            ← schedule_type=INVALID_ENUM_XXX
│   └── bad-too-large.xlsx               ← 5500 行作业
│
├── 03-job-instance-states/              ✓ SQL seed ✓ trigger 脚本
│   ├── README.md
│   ├── seed-job-instances.sql           ← RUNNING/SUCCEED/FAILED/BLOCKED + FAILED partition
│   └── trigger-and-wait.sh              ← 真触发跑流水线
│
├── 04-approvals-pending/                ✓ SQL seed
│   ├── README.md
│   └── seed-pending-approvals.sql       ← 通用 + Catch-up + 配置审批
│
├── 05-config-release-flow/              ✓ payload × 5
│   ├── README.md
│   └── payloads/
│       ├── release-create.json
│       ├── release-submit-approval.json
│       ├── release-gray.json
│       ├── release-publish.json
│       └── release-rollback.json
│
├── 06-file-pipeline/                    ✓ 样本文件 + payload × 3
│   ├── README.md
│   ├── samples/
│   │   ├── sample-orders.csv            ← 正常上传样本
│   │   ├── sample-empty.csv             ← 空文件
│   │   └── sample-invalid-encoding.csv  ← UTF-16(非 UTF-8)
│   └── payloads/
│       ├── file-redispatch.json
│       ├── file-archive.json
│       └── arrival-group-action.json
│
├── 07-outbox-stuck/                     ✓ SQL seed
│   ├── README.md
│   └── seed-outbox-stuck.sql            ← 3 条 STUCK/GIVE_UP outbox
│
├── 08-system-level/                     ✓ payload × 8
│   ├── README.md
│   └── payloads/
│       ├── api-key-create.json
│       ├── webhook-create.json
│       ├── notification-channel-email.json
│       ├── notification-channel-feishu.json
│       ├── notification-rule-job-failed.json
│       ├── tag-batch-create.json
│       ├── user-create.json
│       ├── system-parameter-update.json
│       └── archive-policy-update.json
│
├── 09-self-service/                     ✓ payload × 3
│   ├── README.md
│   └── payloads/
│       ├── rerun-request.json
│       ├── compensation-request.json
│       └── quota-request.json
│
└── 10-rbac-users/                       ✓ 用户矩阵 + seed 脚本
    ├── README.md
    ├── users.json                       ← 5 个 RBAC 角色测试用户
    └── seed-users.sh                    ← 一键批量创建
```

## 测试分组运行策略

```
e2e/
├── @smoke    (smoke/navigation/cross-navigation/a11y/system-pages)  ~3 min
├── @core     (job/approval/release/file/notification/tenant)        ~12 min
├── @system   (api-key/tag/user/webhook/system-param/ai-chat)        ~5 min
├── @rbac     (rbac-denial)                                          ~1 min
├── @errors   (error-recovery)                                       ~1 min
└── @edge     (excel-import/excel-edge-cases)                        ~5 min
```

跑测命令:
```bash
# 提交前冒烟
npx playwright test --grep @smoke

# PR 完整回归(workers=2 平衡速度 / 稳定)
npx playwright test --workers=2

# CI 全量(retries=2,夜里跑)
CI=1 npx playwright test
```

## 上线 BE 真 bug(已 skip,待修)

| 接口 | 现状 | spec | 待 BE |
|---|---|---|---|
| GET `/api/console/workflow-definitions/{id}` | 404 | job-ops.spec.ts:178 skip | 实现 detail 端点 |
| PATCH `/api/console/workflow-definitions/{id}` | 404 | job-ops.spec.ts:150 skip | 实现 toggle 端点 |

## 数据准备顺序(完整一轮)

```bash
# 1. 基线租户(已存在则跳)
# 1a. 准备永久 ta/tb/tc(FE 走 /config/tenant-package 上传 01- 的 Excel)
# 1b. 造临时 td-th(一次性)
cd 00-tenant-lifecycle && ./seed-tenants.sh

# 2. 状态机数据(BE 同事执行 SQL,FE 跑时已就绪)
psql -h localhost -p 15432 -U batch -d batch_console \
  -f 03-job-instance-states/seed-job-instances.sql \
  -f 04-approvals-pending/seed-pending-approvals.sql \
  -f 07-outbox-stuck/seed-outbox-stuck.sql

# 3. RBAC 用户
cd 10-rbac-users && ./seed-users.sh

# 4. 跑全量
cd /Users/dengchao/Downloads/batch-console
npx playwright test --workers=2

# 5. 收尾
cd batch-console-test-data && ./cleanup-hard.sh --execute   # 删 td~th + 测试 APIKey/Webhook 等
```

## 验证一轮的产出

- 自动报告:`playwright-report/index.html`
- 失败 trace:`test-results/<test-name>/trace.zip`(playwright show-trace)
- 控制台日志:`test-results/<test-name>/console.log`(失败时自动落盘)

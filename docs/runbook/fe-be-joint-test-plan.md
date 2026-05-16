# FE↔BE 联调测试方案

> 目标:让前后端联调有一份**可执行、可复现、可量化**的测试流程。
> 当前阶段:**B 档**(CRUD 闭环);C 档(完整 QA 级)留待后续。

## 档位定义

| 档位 | 含义 | 预估耗时 |
|---|---|---|
| A. 页面渲染冒烟 | 每页能打开、无 ErrorBoundary、无 console error | ~30 min |
| **B. 页面 CRUD 闭环**(本次目标) | 每个有写操作的页跑 create → read → update → delete 全流程 | ~4–6 h |
| C. 完整 QA 级覆盖 | 表单校验、错误态、权限拒绝、空态、边界值、键盘、移动端、a11y | ~3–5 天 |

---

## 路线总览

```
Phase 0 (准备 ~30 min)
   └─ 建 tx 隔离租户 + 修 e2e session 互锁 + 写 cleanup

Phase 1 (API 层 CRUD ~1.5 h)
   └─ 按依赖序灌数据 + 跑全部写接口 + 输出 BE bug 清单

Phase 2 (FE 渲染对照 ~45 min)
   └─ 拿 Phase 1 真实 BE 数据在 UI 目视核对字段渲染

Phase 3 (UI 完整交互 ~1 h)
   └─ 跑 e2e 套件(含补的 5-8 个新 CRUD spec)

Phase 4 (可选)
   └─ 打包成 CI 候选脚本
```

为什么这个顺序:**API 失败信号最干净(直接定位 BE bug),FE 渲染失败次干净(BE 已确认 OK → drift 或 i18n 问题),UI 交互最复杂(校验 / 状态 / toast 等)**。倒过来跑会被多层 noise 淹掉。

---

## Phase 0 — 准备(~30 min)

**产出**: 干净的测试环境 + 持续可跑的 e2e harness。

### 0.1 建 tx 隔离租户

```bash
# 用 admin 登录拿 cookie
curl -c /tmp/admin.jar -X POST http://localhost:18080/api/console/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 建 tx
curl -b /tmp/admin.jar -X POST http://localhost:18080/api/console/tenants \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"tx","tenantName":"E2E 测试租户 X","description":"自动化测试专用,不要写真实业务数据"}'

# 从 default 模板初始化基础配置
curl -b /tmp/admin.jar -X POST http://localhost:18080/api/console/config/tenant-init \
  -H "Content-Type: application/json" -H "X-Tenant-Id: tx" \
  -d '{"sourceTenantId":"default-tenant","mode":"SKIP_EXISTING"}'
```

### 0.2 修 e2e session 互锁

**问题**: `e2e/.auth/user.json` 存的 JWT 带 sessionVersion。BE 每次 admin 登录都把版本递增,旧 token 立即作废。导致并行/串行 worker 都会半路失效。

**修复**:`e2e/support/fixtures.ts` 加 per-spec 自动刷新:

```ts
// 每个 spec beforeEach 调一次 /api/console/auth/token 拿最新 JWT,
// 写回 storageState,绕开 sessionVersion 锁。
test.beforeEach(async ({ page }) => {
  const res = await page.request.post('/api/console/auth/token')
  if (res.ok()) {
    const data = await res.json()
    // 用新 cookie 覆盖
    await page.context().addCookies([
      {
        name: 'batch_console_token',
        value: data.data.accessToken,
        domain: 'localhost',
        path: '/',
      },
    ])
  }
})
```

### 0.3 写 cleanup 脚本

```bash
# e2e-data/cleanup-tx.sh
#!/usr/bin/env bash
set -e
source _lib/auth.sh
curl -b /tmp/admin.jar -X DELETE \
  http://localhost:18080/api/console/tenants/tx \
  -H "Content-Type: application/json"
# 删租户后 BE 应级联清所有从属配置;若不级联,补单独的循环 DELETE
```

---

## Phase 1 — API 层 CRUD 全覆盖(~1.5 h)

**产出**: `api-test-report.md` + tx 租户里一套完整数据(供 UI 测试消费)。

### 1.1 依赖序

```
1. 租户层      POST/GET/PUT/DELETE /tenants
2. 配置基础层  队列 → 窗口 → 日历 → 节假日 → 配额策略
3. 业务定义层  Job 定义 → Pipeline → 工作流定义 → 文件模板 → 文件渠道
4. 治理观测层  告警路由 → 通知渠道 → 订阅规则 → 系统参数 → 标签
5. 鉴权扩展层  API Key → Webhook → 用户账户
6. 实例操作层  触发 Job → cancel/terminate/retry partition → 工作流 run 操作
7. 自助审批层  rerun-request → compensation-request → quota-request → approve/reject
```

### 1.2 每实体测试模板

```
1. LIST    GET /<entity>?page=1&size=10                    → 期望 200 + 空列表 OR 已有项
2. CREATE  POST /<entity> {payload-with-e2e-prefix}        → 期望 200 + 返回 id
3. READ    GET /<entity>/{id}                              → 期望 200 + 字段与 CREATE payload 一致
4. UPDATE  PUT /<entity>/{id} {modified-payload}           → 期望 200
5. VERIFY  GET /<entity>/{id}                              → 字段确实更新
6. TOGGLE  POST /<entity>/{id}/toggle (如适用)              → 期望 200,状态翻转
7. DELETE  DELETE /<entity>/{id}                           → 期望 200 / 204
8. VERIFY  GET /<entity>/{id}                              → 期望 404
```

### 1.3 数据命名约定

```
code:        e2e-{entity}-{ts}-{rand6}
name:        [E2E TEST] <human-readable>
description: created by api-crud.sh at <ISO timestamp>
tenant:      tx (隔离)
```

### 1.4 失败记录格式

每个失败追加到 `api-test-report.md`:

````markdown
### FAIL: POST /api/console/alert-routings
- request: { ... }
- status: 500
- response: { code: "SYSTEM_ERROR", traceId: "..." }
- 推测原因: ...
- 后续: BE 同事查 traceId
````

---

## Phase 2 — FE 渲染对照(~45 min)

**产出**: `fe-render-diff.md` + 截图。

**做法**:用 `/remote-control` 或浏览器手动打开,切到 `tx` 租户,逐页对照 Phase 1 灌进去的数据。

### 2.1 重点核对清单

| 页面 | 核对什么 | 备注 |
|---|---|---|
| /governance/queues | 列表 + 新建/编辑表单字段名(刚 i18n 改过) | 关注 fieldQueueCode / fieldMaxRunningJobs 等 |
| /governance/quota | 同 | 关注 fieldPolicyCode 等 |
| /governance/windows | 同 | 关注 fieldStartTime / fieldEndStrategy 等 |
| /governance/calendars | 同 + 节假日子抽屉 | |
| /observability/alert-routings | 列表 + 编辑表单 + 9 个字段 | 全新 i18n key |
| /files/templates | 列表 + 详情抽屉 + 编辑表单(11 个字段) | |
| /files/channels | 列表 + 编辑表单(8 个字段) | |
| /jobs/pipelines | 列表 + 详情 + 步骤编辑器 | 关注 stepFieldX placeholder |
| /monitor/job-instances | 列表 + 详情 + 分区列表 | 验证之前 5661 retry 404 提示是否改善 |
| /system/tags | 资源标签 + 标签搜索两个 tab | 验证刚修的 'ce' render bug |
| /approvals | 通用 + Catch-up 两个 tab | |

### 2.2 三类问题分类

- **A. 字段渲染空白**(BE 改了字段名,FE 没跟上)
- **B. 枚举显示 raw code**(没翻译,如 "FAILED" 直接显示)
- **C. 接口 404**(FE 调的路径 BE 不存在,toast "接口不存在")

每发现一个,记到 `fe-render-diff.md`:
```
[A] /governance/queues 列表 - "公平权重" 列空白
  expected: BE.fairShareWeight 字段值
  actual: 空
  page: src/views/governance/QueueConfig.vue:line
  recheck: cookies are correctly set
```

---

## Phase 3 — UI 完整交互测试(~1 h)

**产出**: e2e 红绿矩阵 + 失败 trace。

### 3.1 跑现有套件

```bash
npm run test:e2e
```

预期 Phase 1+2 清干净后,剩下的失败应该集中在**UI 交互层面**(按钮 disabled、表单校验、toast 触发、对话框关闭)。

### 3.2 补我刚改过但未被现有 spec 覆盖的 CRUD

5 个新表单,需要补 spec:
- `e2e/queue-config-crud.spec.ts`(队列/窗口/日历/节假日 4 个对话框)
- `e2e/quota-policy-crud.spec.ts`
- `e2e/alert-routing-crud.spec.ts`(完全没 spec)
- `e2e/file-template-channel-crud.spec.ts`(模板 + 渠道两个对话框)
- `e2e/pipeline-definition-crud.spec.ts`(含步骤编辑器拖拽)

约 30 个 test 增量,~30 min 编写。

### 3.3 已知会跳过

- 移动端 `/m/*`:需要 mobile viewport,本批不做
- `/system/ai-chat`:需要 LLM 后端,不属 CRUD
- `/workflow/designer`:X6 拖拽不好自动化,留人工抽测
- `/observability/trace`:要真实 traceId,Phase 1 顺便造

---

## Phase 4(可选) — CI 候选

把 Phase 0+1+3 打包成 `tools/ci-fe-be-joint.sh`:
```
preflight → phase 0 prepare → phase 1 api crud → phase 3 e2e → cleanup
```
每次 BE 改完跑一遍就知道 FE 哪些页废了。

---

## 测试数据策略

**风格**: 完全脏数据 + 命名空间隔离(决议见后文 ADR)。

- 所有 e2e 写入数据用 `e2e-` 前缀(code)、`[E2E TEST]` 前缀(name)
- 全部落在独立测试租户 `tx`
- 真生产数据看的 `default-tenant` / `ta` / `tb` / `tc` **绝不写入**
- 跑完执行 `cleanup-tx.sh` 一键清光
- 失败也兜底:`trap 'cleanup-tx.sh' EXIT` 在主脚本里

### 拒绝的方案

| 方案 | 拒绝原因 |
|---|---|
| 半真实数据(看起来像业务的 code) | 跟未来真实业务可能撞 code;清理靠 tag 易漏 |
| 直接用 ta/tb/tc | 那是配置导入测试已经在用的租户,写 CRUD 数据会污染 |
| SQL 直接灌库 | 绕过 BE 校验,跟 e2e 目的(测 BE)冲突 |

---

## 风险清单

| 风险 | 缓解 |
|---|---|
| BE 已知 500 错(如 `/users/accounts`)阻塞 Phase 1 | Phase 1 报告里独立列出,不阻塞其他实体继续 |
| sessionVersion 锁让 Phase 3 仍失效 | Phase 0.2 的 per-spec token 刷新机制兜底;若仍失效,降级到 workers=1 + 每 spec 独立 fixtures |
| `tx` 租户删不掉(从属未级联) | cleanup 脚本带循环兜底 DELETE 所有从属(队列/日历/告警路由/Job 定义) |
| 现有 e2e spec 覆盖度声称 ≠ 实际 | 见后文"现有 spec 真实覆盖度"附录 |
| Phase 3 跑出的失败需要 BE 配合 | 每个失败带 traceId,可直接给 BE 同事 |

---

## 现有 e2e spec 真实覆盖度(附录)

| 实体 | spec | 实际深度 |
|---|---|---|
| API Key | `api-key-crud` | 真 CRUD(create + 详情 + revoke) |
| Webhook | `webhook-crud` | 真 CRUD(create + delete) |
| 通知渠道 | `notification-crud` | 渠道有 CRUD;订阅规则 / Webhook 子项只打开对话框 |
| 系统参数 | `system-parameter-crud` | 真 CRUD |
| 租户 | `tenant-ops` | 较全(新建/编辑/暂停/恢复/删除) |
| 用户账户 | `user-account-ops` | 较全(改名/重置密码/启停) |
| Tag | `tag-management-crud` | 只搜索 + 打开新建对话框,未提交 |
| 队列/窗口/日历 | `governance` + `scheduler-governance-ops` | 只 tab 切换 + 启停 toggle;create/edit/delete **未测** |
| 配额 | 同上 | 同 |
| 告警路由 | 无 | **完全未覆盖**(Phase 3.2 补) |
| Pipeline | `job-ops` 一部分 | 未做 create/edit/delete |
| 文件模板/渠道 | `file-center` + `file-ops` | 模板/渠道 create/edit/delete **未覆盖** |
| Job 定义 | `job-ops` | 触发/克隆有,完整 CRUD 半覆盖 |
| RBAC 多角色 | `rbac-denial` | 需要 10-rbac SQL 灌账号(未运行) |
| Job 实例操作 | `monitor-ops` | 需要 03 SQL 灌实例(未运行) |
| 审批 | `approval-ops` | 需要 04 SQL 灌待审批(未运行) |
| Outbox 重投 | `alert-outbox-ops` | 需要 07 SQL 灌 stuck(未运行) |

---

## 执行入口(等批准后填)

```bash
# Phase 0
bash docs/runbook/scripts/phase0-prepare.sh

# Phase 1
bash docs/runbook/scripts/phase1-api-crud.sh

# Phase 2 -- 手工 + 浏览器,看 fe-render-diff.md 模板

# Phase 3
npm run test:e2e
npx playwright test e2e/queue-config-crud.spec.ts \
  e2e/quota-policy-crud.spec.ts \
  e2e/alert-routing-crud.spec.ts \
  e2e/file-template-channel-crud.spec.ts \
  e2e/pipeline-definition-crud.spec.ts

# Phase 4 -- 一键
bash tools/ci-fe-be-joint.sh
```

---

**确认 "开始 Phase 0" 即可动手**。

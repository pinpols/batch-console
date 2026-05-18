# FE↔BE 联调测试方案

> 目标:让前后端联调有一份**可执行、可复现、可量化**的测试流程。
> 演进:**B 档**(CRUD 闭环,已完成 2026-05-16)→ **B+ 档**(联调验收级,本次扩充 2026-05-18)。
> 覆盖范围从"12 核心实体 CRUD"扩到"RBAC 矩阵 + 3 业务剧本 + 多租户 + SSE + 设计器烟测"。

## 档位定义

| 档位 | 含义 | 预估耗时 | 状态 |
|---|---|---|---|
| A. 页面渲染冒烟 | 每页能打开、无 ErrorBoundary、无 console error | ~30 min | ✅ 已做 |
| B. 页面 CRUD 闭环 | 每个有写操作的页跑 create → read → update → delete 全流程 | ~4–6 h | ✅ 2026-05-16 完成 (42/42 PASS) |
| **B+. 联调验收级**(本次新增) | 上一档基础上补 RBAC 矩阵 / 端到端业务流 / 多租户 / SSE / 设计器烟测 | ~4 天 | 🔵 Phase 5–9 |
| C. 完整 QA 级覆盖 | 表单校验、错误态、权限拒绝、空态、边界值、键盘、移动端、a11y | ~3–5 天 | ✅ C 档 2026-05-15 完成 (qa-c-baseline 466/16/0) |
| D. 生产前 sprint | 移动端 CRUD / 多浏览器 / i18n soak / upload 全链路 | ~4-5 天 | ✅ D 档 2026-05-17 完成 |

---

## 路线总览

```
B 档(CRUD 闭环,已完成 2026-05-16)
├─ Phase 0  准备 ~30 min     建 tx 隔离租户 + 修 e2e session 互锁 + 写 cleanup
├─ Phase 1  API CRUD ~1.5 h  按依赖序灌数据 + 跑全部写接口 + 输出 BE bug 清单
├─ Phase 2  FE 渲染 ~45 min  拿 Phase 1 真实 BE 数据在 UI 目视核对字段渲染
├─ Phase 3  UI 交互 ~1 h     跑 e2e 套件(含补的 5-8 个新 CRUD spec)
└─ Phase 4  CI 候选          打包成 CI 候选脚本

B+ 档(联调验收级,2026-05-18 扩充)
├─ Phase 5  Seed + 阻塞 spec 真跑   ~1 天   补 4 个未运行的 SQL/JSON seed,把 4 个被 skip 的 spec 真跑
├─ Phase 6  RBAC 5 角色权限矩阵     ~1 天   5 真实角色 × 关键写接口,验权限/越权/兜底文案
├─ Phase 7  3 个端到端业务剧本       ~2 天   任务失败→重跑→审批 / 文件到达→处理→回执 / 配置灰度→回滚
├─ Phase 8  多租户切换 + SSE 重连    ~0.5 天 切租户竞态 + WebSocket/SSE 断线 + 长连保活
└─ Phase 9  设计器 + AI Chat 烟测   ~0.5 天 X6 拖拽基础烟测 + AI Chat 基础烟测 (允许 mock 后端)
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

## Phase 5 — Seed 补全 + 阻塞型 spec 真跑(~1 天)

**Why**: Plan 附录里 4 个 spec 长期"待 seed",一直没真跑过 BE。

**产出**: `docs/runbook/scripts/seed/` 下 4 个可复跑脚本 + 4 个 spec 转绿。

### 5.1 Seed 脚本清单

| 文件 | 灌什么 | 谁用 |
|---|---|---|
| `seed/03-job-instances.sql` | 各状态 (CREATED/WAITING/RUNNING/FAILED/COMPLETED) 各 5 条 + 分区/步骤 | monitor-ops.spec / monitor-ops 各页 |
| `seed/04-pending-approvals.sql` | 通用审批 5 + Catch-up 5 + Compensation 3 + Quota 3 | approval-ops.spec / approvals 页 |
| `seed/07-outbox-stuck.sql` | 卡住的 outbox 各错误类 (KAFKA_DOWN/TIMEOUT/DLQ) 各 3 条 | alert-outbox-ops.spec / ops-diagnostic |
| `seed/10-rbac-users.sql` | 5 个真实角色 × tx 租户 各 1 个测试账号 (e2e-admin / e2e-cfg / e2e-aud / e2e-tu / e2e-usr) | rbac-denial.spec / Phase 6 |

### 5.2 落地约定
- 所有 seed 用 `e2e-` 前缀 + tx 租户(同 Phase 1 数据隔离原则)
- 每个 seed 配 `cleanup-XX.sql`,反向 DELETE
- 主入口 `bash docs/runbook/scripts/seed-all.sh`,幂等执行(INSERT IGNORE / ON CONFLICT)
- 失败兜底:`trap 'bash docs/runbook/scripts/cleanup-all.sh' EXIT`

### 5.3 真跑前 spec(预期一次性转绿)
```
npx playwright test \
  e2e/monitor-ops.spec.ts \
  e2e/approval-ops.spec.ts \
  e2e/alert-outbox-ops.spec.ts \
  e2e/rbac-denial.spec.ts
```

### 5.4 失败优先级
- BE 字段名/类型 drift → 写 `be-fix-backlog.md`
- FE 选择器/文案过时 → 直接修 spec
- seed 数据本身错(如外键不存在)→ 修 seed

---

## Phase 6 — RBAC 5 角色权限矩阵(~1 天)

**Why**: [rbac_5roles_only](memory:rbac_5roles_only) memory:OPERATOR/VIEWER 是菜单档位标签不是 Spring authority,自由填会触发 URL 兜底 403。BE 实际只有 5 个真实 Spring authority,前端只跑 admin 路径意味着 4 个角色的权限边界**从来没真验过**。

**产出**: `e2e/rbac-matrix.spec.ts`(单文件,~120 断言)+ 矩阵报告。

### 6.1 5 真实角色 × 关键写接口矩阵

| 角色 \ 接口 | tenants 写 | queues 写 | quotas 写 | configs 发布 | job-defs 写 | api-keys 写 | users 写 | self-service 提单 | reports 导 |
|---|---|---|---|---|---|---|---|---|---|
| ROLE_ADMIN | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ROLE_CONFIG_ADMIN | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| ROLE_AUDITOR | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| ROLE_TENANT_USER | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| ROLE_USER | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

(✅ = 应返 200/202,❌ = 应返 403 且 toast 走"权限不足"i18n 不是裸 message)

### 6.2 每格 3 个断言
1. 后端 HTTP code 与期望一致
2. toast title 命中(成功:无 toast;失败:"权限不足")
3. 列表/创建按钮在 UI 上的可见性 vs 后端权限一致(`usePermission.canMutateConfig` / `canManageSystem` 已对齐)

### 6.3 跨租户越权额外测
- 任意非 admin 角色用 X-Tenant-Id: ta 调 tb 的资源 → 期望 403 或 NOT_FOUND(BE 选其一,不能 200)
- 用 admin 切租户,验 `/auth/me` 在切前/切后返回的 permissions 是否一致

### 6.4 落地
- 用 Phase 5.1 的 `seed/10-rbac-users.sql` 灌 5 个测试账号
- spec 用 storageState 在每个 test 切角色:`test.use({ storageState: 'e2e/.auth/role-${role}.json' })`

---

## Phase 7 — 3 个端到端业务剧本(~2 天)

**Why**: 单实体 CRUD 全绿不等于业务流通。生产事故 80% 在"接口都 OK 但流程串不上"。

**产出**: `e2e/scenario-*.spec.ts` × 3,每个剧本 ≤ 5 min,每步带 traceId。

### 7.1 剧本 A:任务失败 → 重跑 → 审批

```
1. trigger job-def (e2e-job-fail-001)            POST /jobs/trigger
2. 等实例落到 FAILED                              SSE /stream/job-instances/events
3. 提自助重跑                                     POST /self-service/jobs/rerun-request
4. admin 在 /approvals 看到待审                   GET /queries/approvals
5. admin 批准                                     POST /approvals/batch-approve
6. 等实例重跑 → COMPLETED                          SSE
7. 验审计日志可查                                  GET /queries/audits?resourceId=...
```

断言:每步 status 转移 + 状态机不可逆 + 审批通过后 self-service 单状态变 APPROVED + 审计写入。

### 7.2 剧本 B:文件到达 → 触发批次 → 回执

```
1. presign upload 拿 URL                          POST /files/presign-upload
2. PUT 文件到 OSS / NAS                           直传
3. 文件落 file_template 命中规则                   后台 /file-pipeline-observability
4. 触发 pipeline 实例                              SSE
5. pipeline 各 step 转 RUNNING → COMPLETED         /queries/file-pipelines
6. file_receipt 表里有回执                         /queries/channel-receipts
7. /files/arrival-groups 状态翻到 ARRIVED         /queries/file-arrival-groups
```

断言:文件 status 全链路一致性、step 顺序符合 DAG、回执 channel + receiptPolicy 对得上。

### 7.3 剧本 C:配置灰度发布 → 全量 → 回滚

```
1. create config release v2 (draft)               POST /config/releases
2. 提交审批                                       POST /config/releases/{id}/submit
3. admin 批准                                     POST /config/releases/{id}/approve
4. 灰度到 5% 租户                                  POST /config/releases/{id}/gray
5. 验 5% 租户实际生效,95% 仍 v1                    GET /config/dependencies
6. 全量发布                                       POST /config/releases/{id}/publish
7. 模拟问题 → 回滚                                 POST /config/releases/{id}/rollback
8. 验全部租户回到 v1                               GET /config/dependencies
```

断言:灰度比例真实生效 + 回滚不丢历史 + change-logs 记录完整路径。

### 7.4 通用约束
- 每个剧本独立 setup/teardown,失败不污染其他剧本数据
- 用 `test.step('1. trigger job', ...)` 让 trace 可读
- 失败截图 + HAR + console log 全保留

---

## Phase 8 — 多租户切换 + SSE 重连(~0.5 天)

**Why**: 生产事故里"切租户后看到上一个租户的数据" / "WebSocket 断线后界面僵死" 高频。Plan B 档全程单租户,无并发。

**产出**: `e2e/multi-tenant.spec.ts` + `e2e/stream-reconnect.spec.ts`。

### 8.1 多租户切换

```
test('rapid tenant switch 不应错位 profile', async ({ page }) => {
  for (const id of ['ta', 'tb', 'tc', 'tx']) {
    await switchTenant(page, id)
    // 立刻切下一个,不等 /auth/me 完成
  }
  // 最后验:UI 显示的 tenant + 实际 permissions + 菜单 都跟 tx 一致
})
```

测点:
- 切租户期间 inflight /auth/me 不被旧响应覆盖(`auth.ts` 的 inflightTenantId 校验)
- 切完租户菜单 / role chip / 操作权限 都即时更新
- 同一接口连续切 3 次 = 没有 cookie 串台

### 8.2 SSE/WebSocket 重连

```
test('SSE 断线 5s 后自动重连,不丢消息', async ({ page }) => {
  await page.goto('/monitor/instances')
  // 模拟断网 5s
  await page.context().setOffline(true)
  await page.waitForTimeout(5000)
  await page.context().setOffline(false)
  // 期望:8s 内界面自动重连,后续推送继续显示
})
```

测点:
- 断线 toast / 重连 toast 都出
- 重连后 ticket 重新换 + cursor 继续推不丢消息
- 长连 5min 保活无超时(用 timer fake-time 加速)

---

## Phase 9 — 设计器 + AI Chat 烟测(~0.5 天)

**Why**: B 档放弃这两块,但生产环境用户会用,即使不做完整交互也要确保"打得开 + 不崩"。

**产出**: `e2e/workflow-designer-smoke.spec.ts` + `e2e/ai-chat-smoke.spec.ts`。

### 9.1 工作流设计器烟测(X6)

不测拖拽,只测:
- /workflow/viewer/:id 打开能渲染节点 + 边 + 不崩
- 工具栏所有按钮可点(zoom / fit / undo / 保存)
- 节点点击出右侧详情抽屉
- 真实存量定义 ID 走一遍渲染回归(防 BE 改了拓扑字段)

### 9.2 AI Chat 烟测

允许 BE mock(LLM 后端在 dev 不一定有):
- /system/ai-chat 打得开 + 输入框可输入 + 发送按钮 enabled
- mock 一条 SSE 响应,验流式渲染 + Markdown 解析不崩
- 历史会话切换不串

### 9.3 已知 OK 跳过
- 真 LLM 调用质量(属业务 QA 不是联调)
- 设计器拖拽创建/连线(C/D 档手测覆盖)

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

## 现有 e2e spec 真实覆盖度(附录,2026-05-18 更新)

| 实体 | spec | 实际深度 | 状态 |
|---|---|---|---|
| API Key | `api-key-crud` + `api-key-validation` | 真 CRUD + 校验矩阵 | ✅ |
| Webhook | `webhook-crud` | 真 CRUD | ✅ |
| 通知渠道 | `notification-crud` + `notification-rule-crud` | 渠道 + 规则真 CRUD | ✅ |
| 系统参数 | `system-parameter-crud` | 真 CRUD | ✅ |
| 租户 | `tenant-ops` + `tenant-config-ops` | 较全(新建/编辑/暂停/恢复/删除/配置导入) | ✅ |
| 用户账户 | `user-account-ops` | 较全(改名/重置密码/启停) | ✅ |
| Tag | `tag-management-crud` + `tag-resource-crud` + `tag-ops` | 真 CRUD + 资源关联 | ✅ |
| 队列/窗口/日历 | `queue-config-crud` + `calendar-holiday-crud` + `governance` + `scheduler-governance-ops` | 真 CRUD + 启停 toggle | ✅ |
| 配额 | `quota-policy-crud` + `quota-policy-validation` | 真 CRUD + 边界值 | ✅ |
| 告警路由 | `alert-routing-crud` + `alert-routing-validation` | 真 CRUD + 校验 | ✅ |
| Pipeline | `pipeline-definition-crud` + `pipeline-definition-validation` | 真 CRUD + 校验 | ✅ |
| 文件模板/渠道 | `file-template-channel-crud` + `file-template-validation` + `file-center` + `file-ops` | 双对话框 CRUD + 校验 | ✅ |
| Job 定义 | `job-definition-crud` + `job-ops` | 真 CRUD + 触发/克隆 | ✅ |
| 工作流定义 | `workflow-definition-crud` | 真 CRUD | ✅ |
| 触发器 | `trigger-crud` + `trigger-ops` | 真 CRUD | ✅ |
| 配置发布 | `config-release-crud` + `config-release-advanced` + `config-release-ops` | 真 CRUD + 灰度/回滚操作 | ✅ |
| 自助服务 | `self-service-forms` + `self-service` | 5 个 Tab 表单 | ✅ |
| **RBAC 多角色** | `rbac-denial` → Phase 6 `rbac-matrix` | seed 10 已写 + 5 角色矩阵 spec | 🔵 B+ 补 |
| **Job 实例操作** | `monitor-ops` | seed 03 已写 + 真跑 | 🔵 B+ 补 |
| **审批** | `approval-ops` + `approval-actions` | seed 04 已写 + 真跑 | 🔵 B+ 补 |
| **Outbox 重投** | `alert-outbox-ops` + `ops-diagnostic` | seed 07 已写 + 真跑 | 🔵 B+ 补 |
| **业务剧本 A** | `scenario-job-fail-rerun-approve` | 任务失败 → 重跑 → 审批 全链路 | 🔵 B+ 新 |
| **业务剧本 B** | `scenario-file-arrival-pipeline` | 文件到达 → 处理 → 回执 全链路 | 🔵 B+ 新 |
| **业务剧本 C** | `scenario-config-gray-rollback` | 灰度发布 → 全量 → 回滚 全链路 | 🔵 B+ 新 |
| **多租户切换** | `multi-tenant` | 切换竞态 + 越权 + cookie 串台 | 🔵 B+ 新 |
| **SSE/WS 重连** | `stream-reconnect` | 断网恢复 + 长连保活 + cursor 续推 | 🔵 B+ 新 |
| **工作流设计器** | `workflow-designer-smoke` | X6 渲染 + 工具栏 + 抽屉(不测拖拽) | 🔵 B+ 新 |
| **AI Chat** | `ai-chat-smoke` | 打开 + 输入 + mock SSE 流式 | 🔵 B+ 新 |

**覆盖度量化(B+ 档完成后)**:
- 12 核心实体 CRUD:**100%**(B 档)
- 全部 ~25 个写表单 CRUD:**100%**(B/C/D 档累计)
- RBAC 5 角色 × 9 关键写接口 = **45 格矩阵**(Phase 6)
- 端到端业务剧本:**3 个核心流**(Phase 7)
- 异步/长连场景:**多租户 + SSE**(Phase 8)
- 烟测兜底:**设计器 + AI Chat**(Phase 9)
- 移动端 11 页 CRUD:**100%**(D 档)
- a11y / 键盘 / 错误态 / soak:**已覆盖**(C/D 档)

---

## 执行入口

### B 档(已完成,作历史参考)
```bash
bash docs/runbook/scripts/phase0-prepare.sh
bash docs/runbook/scripts/phase1-api-crud.sh
# Phase 2 手工 + 浏览器
npm run test:e2e
npx playwright test e2e/queue-config-crud.spec.ts \
  e2e/quota-policy-crud.spec.ts e2e/alert-routing-crud.spec.ts \
  e2e/file-template-channel-crud.spec.ts e2e/pipeline-definition-crud.spec.ts
bash tools/ci-fe-be-joint.sh
```

### B+ 档(本次新增,4 天 sprint)
```bash
# Day 1 — Phase 5  Seed 补全 + 4 阻塞 spec
bash docs/runbook/scripts/seed-all.sh
npx playwright test \
  e2e/monitor-ops.spec.ts e2e/approval-ops.spec.ts \
  e2e/alert-outbox-ops.spec.ts e2e/rbac-denial.spec.ts

# Day 2 — Phase 6  RBAC 5 角色矩阵
npx playwright test e2e/rbac-matrix.spec.ts

# Day 3-4 — Phase 7  3 业务剧本
npx playwright test \
  e2e/scenario-job-fail-rerun-approve.spec.ts \
  e2e/scenario-file-arrival-pipeline.spec.ts \
  e2e/scenario-config-gray-rollback.spec.ts

# Day 4 下半天 — Phase 8 + 9
npx playwright test \
  e2e/multi-tenant.spec.ts e2e/stream-reconnect.spec.ts \
  e2e/workflow-designer-smoke.spec.ts e2e/ai-chat-smoke.spec.ts

# 一键全跑(Phase 5–9)
bash tools/ci-fe-be-joint-bplus.sh
```

### 产出
- `docs/runbook/fe-be-joint-test-report-bplus.md` —— B+ 档执行总结
- `docs/runbook/qa-bplus-phase-reports/` —— 5 个 Phase 的日报
- `docs/runbook/be-fix-backlog.md` —— 真跑出来的新 BE bug 追加

---

**B 档已落 (2026-05-16);B+ 档 5 个 Phase 待执行**。

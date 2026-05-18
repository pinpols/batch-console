# FE↔BE 联调测试方案

> 目标:让前后端联调有一份**可执行、可复现、可量化**的测试流程。
> 演进:**B 档**(CRUD 闭环,已完成 2026-05-16)→ **B+ 档**(联调验收级,本次扩充 2026-05-18)。
> 覆盖范围从"12 核心实体 CRUD"扩到"RBAC 矩阵 + 3 业务剧本 + 多租户 + SSE + 设计器烟测"。

## 档位定义

| 档位 | 含义 | 预估耗时 | 状态 |
|---|---|---|---|
| A. 页面渲染冒烟 | 每页能打开、无 ErrorBoundary、无 console error | ~30 min | ✅ 已做 |
| B. 页面 CRUD 闭环 | 每个有写操作的页跑 create → read → update → delete 全流程 | ~4–6 h | ✅ 2026-05-16 完成 (42/42 PASS) |
| **B+. 联调验收级** | 上一档基础上补 RBAC 矩阵 / 端到端业务流 / 多租户 / SSE / 设计器烟测 | ~4 天 | 🔵 Phase 5–9 |
| C. 完整 QA 级覆盖 | 表单校验、错误态、权限拒绝、空态、边界值、键盘、移动端、a11y | ~3–5 天 | ✅ C 档 2026-05-15 完成 (qa-c-baseline 466/16/0) |
| **C+. 生产健壮性**(本次再扩) | 边界字符 / 安全注入 / 失败路径 / 可观测性 / 性能 / 视觉回归 | ~5 天 | 🟣 Phase 10–15 |
| D. 生产前 sprint | 移动端 CRUD / 多浏览器 / i18n soak / upload 全链路 | ~4-5 天 | ✅ D 档 2026-05-17 完成 |
| **Pro. 混沌+集成真打**(可选) | 故障注入 / 弱网 / 第三方真打(Kafka/OSS/SMTP) | ~2 天 | ⚪ Phase 16 (可选) |

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

C+ 档(生产健壮性,2026-05-18 再扩)
├─ Phase 10 边界值 + 特殊字符矩阵    ~1 天   极大/极小 int / Unicode 全角 / 时区 DST / 大分页 / 空字符串 vs null
├─ Phase 11 安全 / 越权 / 注入       ~1 天   XSS / SQL inj / CSRF / JWT 篡改 / 提权 / 文件越界 / 敏感字段不落日志
├─ Phase 12 业务剧本失败路径深化     ~1 天   Phase 7 三剧本的中断/超时/重复提单/审批拒绝/回滚失败
├─ Phase 13 可观测性自验             ~0.5 天 每个 API 有 traceId / 每个写操作有 audit / 关键指标暴露 / 错误日志结构化
├─ Phase 14 性能 / 大数据量 / 高频   ~1 天   10K 列表 / 100 并发触发 / SSE 大流量 / 大分页 / 大附件
└─ Phase 15 视觉回归 + a11y AA       ~0.5 天 主题切换截图基线 / WCAG AA 对比度 / 焦点陷阱 / 屏读叙述

Pro 档(混沌 + 集成真打,可选)
├─ Phase 16a 故障注入 / 弱网          ~1 天   BE 5xx 注入 / Redis down (fail-closed) / Kafka down / 2G 弱网
└─ Phase 16b 第三方真打               ~1 天   Kafka 实消费 / OSS 实上传 / SMTP 实投递 / Webhook 实接收
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

## Phase 10 — 边界值 + 特殊字符矩阵(~1 天)

**Why**: B/B+ 都用合法常态值。真正的 4xx 长尾在边界、特殊字符、跨时区。

**产出**: `e2e/boundary-matrix.spec.ts`(约 80 断言)+ `e2e/i18n-coverage.spec.ts`。

### 10.1 数字边界
- int32 上下界:`-2147483648` / `2147483647` / `+1` / `-1`
- 0 / 负数 / 浮点位数 / `Number.EPSILON`
- 超界(`2147483648`):FE 拦截 + BE 也得返 400(已修 :max,这次端到端验)

### 10.2 字符串边界
- 长度 0 / 1 / max(@Size 上限)/ max+1
- 空格 / 全空格 / 前后空格(应 trim)
- Unicode:中日韩 / Emoji / RTL(عربي)/ 零宽字符(`​`)
- 全角 vs 半角(`１２３` vs `123`)/ 罗马数字 / 上下标

### 10.3 注入字符(防 XSS / SQL inj / 命令注入)
- `<script>alert(1)</script>` / `';DROP TABLE--` / `${jndi:ldap://}` / `\`rm -rf\``
- 路径穿越:`../../etc/passwd` / `..\..\windows\system32`
- 期望:全部按字面值落库,渲染时转义不执行

### 10.4 时间 / 时区
- ISO 边界:`1970-01-01T00:00:00Z` / `2038-01-19T03:14:07Z`(int32 timestamp)
- 时区:UTC / Asia/Shanghai / Pacific/Apia (UTC+13)
- DST 跨越:2026 美国 3 月第二个周日
- 闰年 2 月 29 / 跨年 12-31 23:59:59

### 10.5 分页 / 排序
- `page=0` / `page=-1` / `page=999999` / `pageSize=0` / `pageSize=10000`
- 多字段排序 / 排序字段不存在 / 排序方向枚举越界

### 10.6 空 vs null vs 缺字段
- 空字符串、null、undefined、字段未传 三种,后端处理一致?

### 10.7 i18n 完整性自动断言(`i18n-coverage.spec.ts`)
- 所有 zh-CN key 都有 en-US 对应(用 vitest 跑,缺一报错)
- 文案没残留 `{xxx}` 占位符未替换
- 切到 en-US 跑全路由,不应出现中文字符(部分品牌词除外)

---

## Phase 11 — 安全 / 越权 / 注入(~1 天)

**Why**: 生产泄露 / 提权 / 注入是 P0 安全事件。Plan B/B+ 都假设友善用户。

**产出**: `e2e/security-matrix.spec.ts` + `tools/security-scan.sh`(被动扫)。

### 11.1 XSS
- 注入 payload 到所有可输入文本字段(name / description / configJson)
- 渲染层应 escape(Vue `{{ }}` 默认 escape;v-html 已在 commit e54bebe 全部清掉,这次回归验)
- JSON preview 不该 `eval` / 不该执行 `<script>`

### 11.2 SQL 注入
- 查询参数:`/queries/jobs?keyword=' OR '1'='1`
- 期望:BE 返结果集为空(MyBatis #{}参数化),不报错不爆库

### 11.3 CSRF
- 跨域 POST 不带 Cookie 应失败(SameSite=Lax 已设)
- Origin/Referer 校验

### 11.4 JWT / Session
- 篡改 JWT payload(改 role) → 应 401
- 过期 JWT → 应触发 refresh 一次,refresh 失败踢登录
- 别人的 token → 应 401(签名验证)
- 并发登录(Plan B+ Phase 8 已部分覆盖)

### 11.5 提权 / 越权
- TENANT_USER 直接 POST /tenants → 403(配合 Phase 6 矩阵)
- 篡改请求 body 里 tenantId 为 ta(自己是 tb) → BE 应忽略或拒绝
- URL ID 替换:`/jobs/123/edit` 改成别的租户的 jobId → 403/404

### 11.6 文件上传越界
- `.exe` / `.bat` / 0 字节 / 超大文件(>500MB) / MIME 伪造 / ZIP bomb
- 上传路径穿越 `../../etc/passwd`
- 期望:校验拒绝,不落盘 / 不返回内部路径

### 11.7 敏感字段日志清查
- 跑一遍主流程,grep 后端日志:`password` / `secret` / `token` / `Authorization` 不应出现明文
- FE console.log 同样不应有
- `logRedact.ts` 已有 sanitize,这次回归确认

### 11.8 速率限制
- 同账号 1s 内调登录 100 次 → 应触发 429
- 错配密码 5 次 → 应锁定(error.auth.account_locked i18n 已就位)

---

## Phase 12 — 业务剧本失败路径深化(~1 天)

**Why**: Phase 7 三个剧本都是 happy path。生产 bug 80% 在失败/中断/重复路径。

**产出**: `e2e/scenario-*-failure.spec.ts` × 3 + 容错矩阵。

### 12.1 剧本 A 失败路径(任务失败→重跑→审批)
- 审批被拒绝(非批准) → self-service 单状态 REJECTED + 不重跑
- 审批超时(假装 admin 一直不审) → 单状态 EXPIRED(BE 有 expireAt)
- 重复提单(同一 jobInstanceId 提 2 次重跑) → 第二次 409 + 友好提示
- 重跑过程中 worker 挂掉 → 实例 status 应回 FAILED + 可再次重跑
- 重跑后又失败 → 可再次提单(链式)

### 12.2 剧本 B 失败路径(文件到达→处理→回执)
- 文件上传中断(浏览器关) → presign URL 失效后清理
- pipeline 某 step 失败 → 整个 pipeline FAILED + 失败 step 标记 + 不影响其他文件
- 回执 channel 不可达 → 回执失败 + outbox 重投 + 最终落死信
- 文件已处理过(checksum 重复) → 幂等返已有结果,不重复处理

### 12.3 剧本 C 失败路径(灰度→全量→回滚)
- 审批阶段被拒 → 不可发布
- 灰度阶段发现错误 → 中止灰度 + 状态回 APPROVED
- 全量发布后 5 分钟内回滚 vs 24 小时后回滚(应都 OK)
- 回滚失败(配置依赖被新版本污染) → 友好错 + 不丢历史
- 同时两人发布 → 乐观锁冲突 409

### 12.4 通用容错断言
- 每个失败路径不应留脏数据(下次创建不冲突)
- 每个 4xx/5xx 都应有 i18n 友好文案(不能裸 `error.xxx.yyy`)
- 每个失败都应在 audit log 留痕

---

## Phase 13 — 可观测性自验(~0.5 天)

**Why**: 出事故时"找不到 traceId / 没 audit log / metrics 不上报" 比 bug 本身更致命。

**产出**: `e2e/observability-coverage.spec.ts` + `tools/log-scan.sh`。

### 13.1 traceId 覆盖
- 抓 e2e 跑过的所有 HTTP 响应,断言 100% 带 `meta.traceId`
- traceId 在 BE access.log + business.log + error.log 三处都能搜到
- FE toast 失败时也要带 traceId(已实现,这次回归)

### 13.2 audit log 覆盖
- 所有写操作(POST/PUT/DELETE)应在 `/api/console/queries/audits` 查到
- audit 字段完整:operator / operationType / resourceType / resourceId / before / after / traceId
- 跑完 Phase 1 CRUD 后,audit 表条数 ≥ 写操作次数

### 13.3 metrics 暴露
- `/actuator/prometheus` 暴露 BE 关键指标:`http_server_requests_seconds` / `executor_active` / `jdbc_connections_active`
- 跑压测后(Phase 14)指标曲线合理

### 13.4 错误日志结构化
- 所有 error 级日志带 traceId + level + class + message + stack
- 不应有裸 print(`println`)
- 不应有 `Exception:` 没堆栈的情况

---

## Phase 14 — 性能 / 大数据量 / 高频(~1 天)

**Why**: 生产环境单租户 10K+ jobDef / 100K+ instance,Plan B 测试数据都 < 100 条。列表慢/卡死/超时 都属于"功能没坏但用不了"。

**产出**: `e2e/performance.spec.ts` + `tools/load-test.sh`(k6 脚本)。

### 14.1 大列表性能
- jobDef 灌 10K 条,/jobs/definitions 列表首屏渲染 ≤ 2s
- 滚动 / 分页切换 < 500ms
- 排序 / 过滤 < 1s
- ProTable 虚拟滚动是否真省内存(devtools heap snapshot)

### 14.2 并发触发
- k6 模拟 100 并发触发 / 1s 持续 60s
- 期望:BE QPS 100+ / 错误率 < 0.1% / p99 < 500ms
- FE 在此压力下打开列表仍正常

### 14.3 SSE 大流量
- 推 1000 事件 / s,持续 60s,FE 不掉帧不堆积
- DOM 节点不应无限增长(用 LRU 截留最近 200 条)

### 14.4 大附件
- 上传 500MB 文件,进度条平滑 + 不卡 UI
- 下载 500MB 文件,断点续传可工作

### 14.5 大分页
- pageSize=200 列表能渲染
- pageSize=2000 应 BE 限制返 400(防内存爆炸)

---

## Phase 15 — 视觉回归 + a11y AA(~0.5 天)

**Why**: D 档跑过 a11y 烟测,但没基线;品牌升级 / 主题切换时容易回归。

**产出**: `e2e/visual-regression.spec.ts`(Playwright screenshot 基线) + `e2e/a11y-aa.spec.ts`。

### 15.1 视觉基线
- 主流路由 30 页 × 主题 2(明/暗) × 分辨率 2(1366/1920) = 120 截图
- 首次跑生成基线,后续 diff ≤ 1% 通过
- 失败要 review 截图(不是自动通过)

### 15.2 WCAG AA
- 颜色对比度 ≥ 4.5:1(正文) / 3:1(大字)
- 焦点环可见(Phase C 已做基础,这次定量)
- 屏读叙述:菜单 / 主操作 / 错误提示 都有 aria-label
- 键盘可达:所有可点的都能 Tab + Enter / Space

### 15.3 焦点陷阱
- Modal/Drawer 打开后 Tab 不应跳出
- ESC 关闭后焦点回到触发按钮(C 档已有 keyboard-flow,这次扩到全部抽屉)

---

## Phase 16 — 混沌 + 集成真打(Pro,可选 ~2 天)

**Why**: 真实生产故障如 Redis 断线 / Kafka 挂 / OSS 限流,本地都没复现过,事故只能现场学习。

**产出**: `e2e/chaos-*.spec.ts` + `tools/chaos/`。

### 16a 故障注入(~1 天)
- BE 5xx 注入(用 toxiproxy 拦 /api/* 返 500) → FE retry + toast 合理
- Redis down(`docker stop redis`)→ 幂等接口 fail-closed 不雪崩(已 i18n)
- Kafka down → outbox 堆积 + 重投 + 最终落死信(Phase 5 spec 已覆盖,这次端到端)
- DB 慢查询(toxiproxy 注入 5s 延迟) → FE loading 出现 + 不卡死
- 2G 弱网(Chrome devtools throttle) → 首屏 ≤ 8s + 关键操作可完成

### 16b 第三方真打(~1 天)
- Kafka:实发消息 → 实消费 → 实落库
- OSS / NAS:实上传 → 实下载 → 校验 checksum
- SMTP:实发邮件到测试邮箱(mailcatcher)→ 验内容 + headers
- Webhook:启 mockoon 接收 webhook → 验 payload + retry on 5xx
- (生产前必须做一次;本地 dev 通常 mock)

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
| **边界 + 特殊字符** | `boundary-matrix` + `i18n-coverage` | int32/Unicode/时区 DST/分页 + i18n key 完整性 | 🟣 C+ 新 |
| **安全 + 注入** | `security-matrix` + `tools/security-scan.sh` | XSS/SQL inj/CSRF/JWT/提权/文件越界/敏感字段日志 | 🟣 C+ 新 |
| **剧本失败路径** | `scenario-*-failure` × 3 | 拒绝/超时/重复提单/中断/乐观锁冲突 | 🟣 C+ 新 |
| **可观测性自验** | `observability-coverage` + `log-scan.sh` | traceId 100%/audit 全/metrics 暴露/日志结构化 | 🟣 C+ 新 |
| **性能压测** | `performance` + `tools/load-test.sh` (k6) | 10K 列表/100 并发/SSE 高频/500MB 附件 | 🟣 C+ 新 |
| **视觉回归 + a11y AA** | `visual-regression` + `a11y-aa` | 120 截图基线/WCAG AA 对比度/焦点陷阱 | 🟣 C+ 新 |
| **混沌注入** | `chaos-*` (Pro 档) | BE 5xx/Redis down/Kafka down/2G 弱网/DB 慢查询 | ⚪ Pro |
| **第三方真打** | (Pro 档) | Kafka/OSS/SMTP/Webhook 实链路 | ⚪ Pro |

**覆盖度量化阶段累积**

| 维度 | A 档 | B 档 | B+ 档 | C 档 | C+ 档 | D 档 | Pro 档 |
|---|---|---|---|---|---|---|---|
| 页面冒烟 | ✅ 100% | | | | | | |
| 核心实体 CRUD | | ✅ 100% | | | | | |
| 全部写表单 CRUD | | 部分 | | ✅ 100% | | | |
| RBAC 矩阵 | | | ✅ 45 格 | | | | |
| 端到端业务流 | | | ✅ happy ×3 | | ✅ failure ×3 | | |
| 异步/长连 | | | ✅ 切租+SSE | | | | |
| 边界值/字符 | | | | 部分 | ✅ 全矩阵 | | |
| 安全 | | | | | ✅ XSS/SQL/JWT/越权 | | |
| 可观测性自验 | | | | | ✅ trace/audit/metrics | | |
| 性能 | | | | | ✅ 10K/100QPS/SSE/500MB | | |
| 视觉回归 + a11y AA | | | | 部分 | ✅ 120 基线/AA | | |
| 移动端 | | | | | | ✅ 11 页 | |
| i18n soak / 多浏览器 | | | | | | ✅ | |
| 混沌注入 | | | | | | | ✅ |
| 第三方真打 | | | | | | | ✅ |

**A/B/B+/C/C+/D 累计完成后 → 联调验收 90%+ / 生产健壮性 95%+ / Pro 加完 ≈ 99%**

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

### B+ 档(4 天 sprint)
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

### C+ 档(生产健壮性 ~5 天 sprint)
```bash
# Day 1 — Phase 10  边界 + 特殊字符
npx playwright test e2e/boundary-matrix.spec.ts e2e/i18n-coverage.spec.ts

# Day 2 — Phase 11  安全
npx playwright test e2e/security-matrix.spec.ts
bash tools/security-scan.sh

# Day 3 — Phase 12  剧本失败路径
npx playwright test e2e/scenario-job-fail-rerun-approve-failure.spec.ts \
  e2e/scenario-file-arrival-pipeline-failure.spec.ts \
  e2e/scenario-config-gray-rollback-failure.spec.ts

# Day 4 上半 — Phase 13  可观测性
npx playwright test e2e/observability-coverage.spec.ts
bash tools/log-scan.sh

# Day 4 下半 — Phase 14  性能(k6)
bash tools/load-test.sh
npx playwright test e2e/performance.spec.ts

# Day 5 — Phase 15  视觉回归 + a11y AA
npx playwright test e2e/visual-regression.spec.ts e2e/a11y-aa.spec.ts

# 一键全跑(Phase 10–15)
bash tools/ci-fe-be-joint-cplus.sh
```

### Pro 档(混沌 + 集成真打 ~2 天,可选)
```bash
# 启混沌代理 (toxiproxy + docker stop redis/kafka 等)
bash tools/chaos/setup.sh

# Day 1 — Phase 16a  故障注入
npx playwright test e2e/chaos-be-5xx.spec.ts e2e/chaos-redis-down.spec.ts \
  e2e/chaos-kafka-down.spec.ts e2e/chaos-slow-network.spec.ts

# Day 2 — Phase 16b  第三方真打
bash tools/integration/kafka-real.sh
bash tools/integration/oss-real.sh
bash tools/integration/smtp-real.sh
bash tools/integration/webhook-real.sh
```

### 产出
- `docs/runbook/fe-be-joint-test-report-bplus.md` —— B+ 档总结
- `docs/runbook/fe-be-joint-test-report-cplus.md` —— C+ 档总结
- `docs/runbook/fe-be-joint-test-report-pro.md` —— Pro 档总结(可选)
- `docs/runbook/qa-bplus-phase-reports/` / `qa-cplus-phase-reports/` / `qa-pro-phase-reports/`
- `docs/runbook/be-fix-backlog.md` —— 真跑出来的新 BE bug 追加
- `e2e/.visual-baseline/` —— 视觉回归基线截图
- `tools/load-test-results/` —— k6 性能压测报告 + Grafana 仪表板

---

**已落**:A 档 / B 档 (2026-05-16, 42/42) / C 档 (2026-05-15, 466/16/0) / D 档 (2026-05-17)。
**待执行**:B+ 档 (Phase 5–9, ~4 天) / C+ 档 (Phase 10–15, ~5 天) / Pro 档 (Phase 16, 可选 ~2 天)。
**全档累计 ≈ 99% 覆盖**(剩余 1% 是真实 LLM 调用质量、真实生产数据迁移、真实长跑稳定性,属业务 QA 不属联调)。

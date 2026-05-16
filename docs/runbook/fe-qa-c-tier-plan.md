# C 档 QA 完整覆盖 — 测试方案

> 衔接 [fe-be-joint-test-plan.md](./fe-be-joint-test-plan.md) 的档位定义。
> A 档(冒烟)/ B 档(CRUD 闭环)已 PASS。本档目标:**表单校验 / 错误态 / 键盘 / a11y / 边界值** 的系统性 QA。
> **预估**:3–5 天(净工时 16–28 h,看人工抽测多少)。

---

## 目标 & 不做什么

**目标**

1. 把现有 axe baseline 从「5 页 critical-only」推到「全部业务页 critical + serious + 表单 keyboard flow」。
2. 把现有 20 个声明 `rules` 的表单的校验路径写成 spec,捕住 i18n 缺失、required 漏标、type 校验跳过等回归。
3. 把"接口 5xx / 404 / 网络抖动"的错误态从 1 个 spec 扩到典型 P0 写操作页。
4. 把"边界值"做成数据驱动表,而不是逐 case 手工。

**不做什么**(留人工抽测 / 后续档)

- 移动端 `/m/*`(viewport 切换 + 触摸事件成本高,留下一档)
- 多浏览器矩阵(Safari/Firefox)(只在 release 前手工跑)
- 性能 / 内存基线(独立专题)
- `/workflow/designer` X6 拖拽 a11y(图编辑器 a11y 是研究课题,不在本档)

---

## 现状盘点(开工前已知)

| 维度 | baseline | 缺口 |
|---|---|---|
| **a11y** | `e2e/a11y.spec.ts` 跑 5 页 axe wcag2aa,只 critical fail | 业务页未覆盖、serious 全部宽容、`aria-label` 整体仅 7 处 |
| **错误态** | `e2e/error-recovery.spec.ts` 跑 GET 404/429/503/offline | 写操作(POST/PUT/DELETE)5xx/409/422 全没覆盖 |
| **表单校验** | 20 个 view 声明 `rules`,但没有 spec 单独跑校验路径 | required 漏标、disable→submit 路径、异步校验失败未测 |
| **键盘** | 全局 `:focus-visible` + Login 一处可达 | Tab 链未审、Dialog ESC 关闭未审、ProTable 列表行键盘选中未审 |
| **边界值** | 散落在各 CRUD spec,无统一表 | 跨页一致性差(同一字段在 A 页 max=200,B 页限 500) |

工具栈已就位:`@axe-core/playwright` ^4.11、Playwright `test`、`expect` 都有。

---

## 优先级矩阵

**P0 — 必覆盖**(写操作 + 高频 + 已知踩过坑)

| 页面 | 选入理由 |
|---|---|
| `/login` | 入口,a11y / 键盘必须无障碍 |
| `/governance/queues` (4 个对话框) | 字段最多 + i18n 刚改 |
| `/governance/quota` | 同上 |
| `/observability/alert-routings` | 9 字段 + 联调发现过 BE bug |
| `/files/templates` | 11 字段表单 + 抽屉 + 编辑器 |
| `/files/channels` | 8 字段 |
| `/jobs/pipelines` | 步骤编辑器 + 拖拽 |
| `/system/users` | 改密 / 启停 / 重置 — 误操作风险 |
| `/system/api-keys` | revoke / 重生成 — 不可逆 |
| `/approvals`(两个 tab) | OPERATOR / ADMIN 两套权限路径 |

**P1 — 强烈建议覆盖**

| 页面 | 理由 |
|---|---|
| `/governance/calendars`(含节假日抽屉) | 嵌套表单层级深 |
| `/scheduler/snapshot` | 表单 + 列表混合 |
| `/system/notifications`(渠道 / 订阅 / Webhook) | 三 tab 之间状态串扰风险 |
| `/system/tenant-list` | 跨租户切换 + 表单 |
| `/system/triggers` | pause/resume 切换 |
| `/observability/audit` | 长 description HTML 解码已踩过 |

**P2 — 顺手做**

- `/ops/diagnostic` / `/ops/summary` / `/observability/event-catalog` / `/files/list`(纯只读为主,a11y 跑通就行)

---

## 四个维度的检查清单

### 1. 表单校验(form-validation)

每个 P0 表单跑以下子矩阵:

| 子项 | 期望 | 失败信号 |
|---|---|---|
| 全空提交 | submit disabled OR 弹 required 文案 | 提交进 BE 拿 400 / 静默关闭 |
| 单个 required 字段空 | 该字段红 + 文案 + submit 不发请求 | 文案是 i18n key `form.xxx.required` 而非渲染值 |
| 长度超上限 | 超出即触发 max 文案,**不允许继续输入** | 允许超出但 submit 才报 |
| 长度刚到上限 | 通过,正常 submit | min/max 边界写反 |
| 类型不匹配(数字框输字母) | input mask 拒收 OR 校验失败 | 提交后 BE 500 |
| 异步校验失败(如 code 重名) | 文案显示 + submit 失败 | 没绑 form 状态导致 submit 仍发请求 |
| 提交中再次点 submit | 按钮 loading + disabled | 并发提交 |
| 取消按钮 | 关闭弹窗 + reset 表单 | 下次打开残留上次输入 |
| ESC 键 | 同取消 | 不响应 |

**记录格式**

```
[form-validation] /governance/queues - 新建队列
  case: maxRunningJobs 输入字母
  expected: input 拒收 OR rule 触发 message 显示
  actual: 允许输入 "abc",submit 后 BE 返回 500
  page: src/views/governance/QueueConfig.vue:line
```

### 2. 错误态(error-state)

模板:用 `page.route(...)` 拦截关键写操作,注入以下响应,断言 UI 兜底。

| 注入 | 期望 UI 行为 |
|---|---|
| 400 `{code:"VALIDATION_FAILED", message:"...", traceId}` | toast 显示 message,**保留**表单已填值 |
| 401 | 跳登录,清本地态(已有 baseline,仅回归) |
| 403 | toast "权限不足",**不**跳登录 |
| 404 业务(`{code:"NOT_FOUND",message:"queue not found"}`) | 显示领域 message,**不**触发"接口不存在" |
| 404 路由真缺(Spring 默认) | 触发"接口不存在或版本不匹配"(交互测互拦) |
| 409 `{code:"CONFLICT"}` | toast,表单保留 |
| 422 `{code:"BIZ_INVALID"}` | toast,表单保留 |
| 5xx `{code:"SYSTEM_ERROR", traceId}` | toast 含 traceId 可复制 |
| 网络挂(`context.setOffline(true)`) | toast 提示离线,不卡死 |
| 慢请求(>10s 延迟) | submit 按钮 loading,不重复发请求 |

**最低覆盖**:每个 P0 写操作至少注入 `400 / 5xx / 网络挂` 三类。

### 3. 键盘 / a11y(keyboard + a11y)

**单页 a11y baseline 收紧**

```ts
// e2e/a11y.spec.ts 把 SEVERITY_TO_FAIL 从 ['critical'] 改为 ['critical','serious']
// 并把覆盖页从 5 个扩到上面 P0 列表(10 页)。
// 例外用 builder.disableRules(['color-contrast-enhanced']) 单页声明,不批量豁免。
```

**键盘流程**(每个 P0 跑一次)

| 步骤 | 期望 |
|---|---|
| Tab 进页 | 第一个可聚焦元素拿到 ring(`:focus-visible` 起效) |
| Tab 一圈 | 焦点顺序与视觉顺序一致,不跳跃 |
| 列表行 Enter | 进入详情 OR 触发主操作 |
| 打开 Dialog 后 Tab | 焦点**陷阱**在 Dialog 内,不溢出到背景 |
| Dialog ESC | 关闭 |
| Dialog Enter(焦点在文本框) | 提交 OR 走 textarea 换行,**不**误提交 |
| 列表选中状态 + ↑↓ | 在行间移动 |

**aria 必检项**

- 所有 `el-button` 纯图标必须有 `aria-label`(grep 兜底:`<el-button[^>]*><el-icon` 后面 50 字符内无 `aria-label` → 报错)
- Dialog 必须有 `role="dialog"` + `aria-labelledby` 指向标题(EP 默认已加,抽样验证)
- 表单 label 必须 `for` 绑定 input id(EP 默认已加,抽样验证)
- 列表分页器 `nav role="navigation"` + 当前页 `aria-current="page"`

### 4. 边界值(boundary)

**统一表**:为每个 P0 写操作建一份 `boundary.json`,格式如下:

```json
{
  "endpoint": "POST /api/console/queues",
  "fields": [
    { "name": "queueCode", "type": "string", "min": 1, "max": 64, "regex": "^[a-zA-Z0-9_-]+$" },
    { "name": "maxRunningJobs", "type": "int", "min": 1, "max": 10000 },
    { "name": "fairShareWeight", "type": "decimal", "min": 0, "max": 1 }
  ]
}
```

**生成器跑 6 类用例 / 字段**(min-1, min, min+1, max-1, max, max+1),空 + null + 全空白 + 控制字符 各一,记到 `boundary-report.md`。

这部分**不必每字段每次都跑**,改一次 endpoint 跑一次即可,挂在 e2e 选跑模式后面。

---

## 执行节奏(5 天)

**Day 1 — baseline 收紧 + 工具就位**

- 把 `e2e/a11y.spec.ts` 从 5 页扩到 P0 10 页,`SEVERITY_TO_FAIL` 加 `serious`
- 建 `e2e/support/form-helpers.ts` 封装"全空提交 / 单字段缺 / 类型不匹配"通用 actions
- 建 `e2e/support/error-injection.ts` 封装拦截写操作 + 注入 400/5xx/网络挂 三套
- 跑一次,把当前 baseline 暴出来的违规整理成 `qa-c-baseline.md`(零修复,仅记账)

**Day 2 — P0 表单校验 spec**(governance / files / observability/alert-routings)

- 每页一个 spec(`<page>-validation.spec.ts`),用 Day 1 的 form-helpers 跑子矩阵
- 同步给 `src/views/<page>.vue` 修发现的真问题(i18n key 缺失 / required 漏标)

**Day 3 — P0 错误态 spec**(同 P0 页 + system/* + approvals)

- 一个综合 spec `error-states.spec.ts`,用 route 拦截批量跑
- 失败的 page 改 `interceptors` 兜底 + 表单 catch

**Day 4 — 键盘 / a11y 深挖**

- P0 10 页人工跑一遍键盘流程,记到 `qa-c-keyboard-report.md`
- 改 `aria-label` 漏的纯图标按钮(grep 出来批改)
- Dialog focus-trap 缺失的补 `:trap` / `focus-trap-vue`

**Day 5 — 边界值 + 收尾**

- 写 `e2e-data/boundary.sh` 生成器,跑 P0 写操作的边界表
- 把 Day 1~4 真改的 bug 合并提 PR
- 输出 `fe-qa-c-tier-report.md`:每 P0 页一行,validation/error-state/a11y/keyboard 四个勾

---

## 失败记录格式(沿用 B 档风格)

所有问题汇总到 `docs/runbook/fe-qa-c-tier-report.md`,按维度分章节,每条:

```
### [validation / error-state / a11y / keyboard / boundary] <page> - <case>
- repro: <最小操作步骤 OR spec 文件:行号>
- expected: ...
- actual: ...
- 推测原因: ...
- 修复 PR / commit: <留空,补在事后>
```

---

## 数据策略(沿用 B 档)

- 所有 spec 在 `tx` 租户跑
- 写入数据 `e2e-` 前缀 + `[E2E TEST]` name
- 失败的 boundary 用例**不**回滚 BE 状态 — 留作 BE 排查依据,跑完 `cleanup-tx.sh` 一键清

---

## 风险清单

| 风险 | 缓解 |
|---|---|
| axe `serious` 收紧后大面积红 | Day 1 baseline 不动手修,仅记账,Day 4 集中改 |
| EP 默认组件 a11y 违规(EP 上游问题) | 单 rule disable,**不**批量豁免;在报告里独立小节列 EP 上游问题 |
| 移动端测试漏 | 本档明确不做,留下一档 |
| 拦截器修改影响生产 | `error-states.spec.ts` 只用 `page.route` 客户端拦截,不动 `interceptors.ts` 生产逻辑 |
| 5 天工时超期 | Day 5 可砍 boundary 自动化,降级为人工抽 3 个最重要 endpoint |

---

## 出口标准(Done = ?)

- [ ] `e2e/a11y.spec.ts` 覆盖 P0 10 页 + `serious` 不漏 + critical = 0
- [ ] P0 10 页每页一份 `<page>-validation.spec.ts`,跑表单子矩阵
- [ ] `e2e/error-states.spec.ts` 覆盖 P0 写操作的 400/5xx/网络挂三类
- [ ] `docs/runbook/qa-c-keyboard-report.md` 写齐 P0 10 页键盘流程的人工抽测结论
- [ ] `e2e-data/boundary.sh` 至少跑 P0 5 个 endpoint 的边界表
- [ ] `docs/runbook/fe-qa-c-tier-report.md` 输出最终红绿矩阵 + bug list 关联 PR

---

## 后续档(D 档预告,不在本次)

| 项 | 预估 |
|---|---|
| 移动端 `/m/*` 完整 CRUD(本档冒烟已通) | 1-2 天 |
| 多浏览器矩阵(Chromium / Webkit / Firefox) | 0.5 天 (CI 配置 + 跑) |
| i18n 切换稳定性(zh↔en 中实时切) | 0.5 天 |
| 长会话稳定性(8h+ 不刷新) | 1 天(soak test) |
| 权限矩阵全跑(ADMIN/OPERATOR/VIEWER/CONFIG_ADMIN/AUDITOR/TENANT_USER × 全菜单) | 1-2 天 |

---

## 附录 A:P0 页表单字段清单(从 BE DTO 抽,Day 2 参照)

> 提取自 `~/Downloads/file-batch-system/.../web/request/**`,列校验项给 boundary spec 用。

### `/governance/queues` — ResourceQueueCreateRequest

| 字段 | 类型 | 必填 | 长/范围 | 枚举 |
|---|---|---|---|---|
| tenantId | string | @ValidTenantId | — | — |
| queueCode | string | ✓ | ≤128 | — |
| queueName | string |  | ≤256 | — |
| queueType | string | ✓ | ≤32 | IMPORT/EXPORT/DISPATCH/MIXED |
| maxRunningJobs | int |  | ≥0 | — |
| maxRunningPartitions | int |  | ≥0 | — |
| maxQps | int |  | ≥0 | — |
| workerGroup | string |  | ≤128 | — |
| resourceTag | string |  | ≤64 | — |
| priorityPolicy | string |  | ≤32 | FIFO/PRIORITY/FAIR (默认 FIFO) |
| fairShareWeight | int |  | ≥1 | — |
| description | string |  | ≤512 | — |

### `/governance/windows` — BatchWindowCreateRequest

字段类似,核心枚举:
- `endStrategy`: STOP / FINISH_RUNNING / CONTINUE
- `outOfWindowAction`: WAIT / FAIL

### `/governance/calendars` — CalendarSaveRequest

- `calendarCode`/`calendarName`/`timezone` ≤128/256/64, 三个 @NotBlank
- `holidayRollRule`: SKIP / NEXT_WORKDAY / PREV_WORKDAY
- `catchUpPolicy`: NONE / AUTO / MANUAL_APPROVAL
- `catchUpMaxDays`: int ≥0

### `/observability/alert-routings` — AlertRoutingSaveRequest

- `routeCode`/`team`/`severity`/`receiver` 都 @NotBlank
- `groupWaitSeconds`/`groupIntervalSeconds`/`repeatIntervalSeconds`: int ≥0

### `/files/templates` — FileTemplateCreateRequest

- `templateCode`/`templateType`/`fileFormatType` @NotBlank
- `templateType`: IMPORT/EXPORT/SHARED
- `fileFormatType`: DELIMITED/FIXED_WIDTH/EXCEL/XML/JSON/BINARY
- `checksumType`: NONE/MD5/SHA-256
- `compressType`: NONE/ZIP/GZIP
- `encryptType`: NONE/AES/PGP/CUSTOM
- `recordLength`/`headerRows`/`footerRows`: int ≥0
- 17+ boolean 安全字段(default false 由 BE 补,FE 不必传)

### `/files/channels` — FileChannelCreateRequest

- `channelCode`/`channelType` @NotBlank
- `channelType`: SFTP/API/API_PUSH/EMAIL/NAS/OSS/LOCAL
- `receiptPolicy`: NONE/SYNC/ASYNC/POLLING
- `timeoutSeconds`: int ≥0(默认 30)

### `/jobs/pipelines` — PipelineDefinitionSaveRequest

- `jobCode`/`pipelineName`/`pipelineType` @NotBlank
- `pipelineType`: IMPORT/EXPORT/PROCESS/DISPATCH
- `steps[]`: 子表单,每项 stepCode/stepName/stageCode/implCode @NotBlank

### `/system/users` — CreateUserAccountRequest

- `tenantId` @ValidTenantId
- `username`: 2-128 字符,正则 `^[a-zA-Z0-9][a-zA-Z0-9._\-]*$`
- `password`: 8-256
- `authoritiesCsv`: ≤512 CSV(ROLE_ADMIN/ROLE_OPERATOR/ROLE_VIEWER/ROLE_TENANT_USER/ROLE_AUDITOR/ROLE_CONFIG_ADMIN)

### `/system/api-keys` — CreateApiKeyRequest

- `keyName`: 1-128 @NotBlank
- `scopes`: ≤512 (String CSV,**不是 array**)
- `expiresAt`: Instant ISO-8601(可空)

### `/governance/quota` — QuotaPolicySaveRequest

- `policyCode` @NotBlank ≤128
- `maxRunningJobsPerTenant`/`maxPartitionsPerTenant`/`maxQpsPerTenant`: int ≥0
- `fairShareWeight`: int ≥1
- `description`: ≤512

### `/approvals` — 无 form,操作为 approve/reject(reason 可选)

---

## 附录 B:工具与代码模板

### B.1 form-helpers.ts 骨架

```ts
// e2e/support/form-helpers.ts
import { type Page, type Locator, expect } from '@playwright/test'

export async function openDialog(page: Page, triggerName: string | RegExp) {
  await page.getByRole('button', { name: triggerName }).first().click()
  await page.waitForTimeout(400) // EP dialog 进场动画
  return page.locator('.el-dialog').first()
}

export async function submitForm(dialog: Locator, btnName = /保存|创建|确定/) {
  await dialog.getByRole('button', { name: btnName }).click({ force: true })
}

/** 全空提交,期望 disabled OR required toast */
export async function expectRequiredBlocked(dialog: Locator) {
  await submitForm(dialog)
  // 任一信号:1) toast warning, 2) form-item error class, 3) submit 按钮 loading=false 说明被拦
  const sig = dialog.locator('.el-form-item.is-error, .el-message--warning, .el-message--error').first()
  await expect(sig).toBeVisible({ timeout: 2000 })
}

/** 字段超长:输 N+1 字符,期望被截断或 rule message */
export async function expectMaxLength(dialog: Locator, label: string | RegExp, max: number) {
  const input = dialog.locator('.el-form-item').filter({ hasText: label }).locator('input,textarea').first()
  const tooLong = 'a'.repeat(max + 1)
  await input.fill(tooLong)
  const value = await input.inputValue()
  expect(value.length, `${label} expected max ${max}, got ${value.length}`).toBeLessThanOrEqual(max)
}

/** 类型不匹配:数字框输字母,期望被拒 */
export async function expectNumericRejection(dialog: Locator, label: string | RegExp) {
  const input = dialog.locator('.el-form-item').filter({ hasText: label }).locator('input').first()
  await input.fill('abc')
  const value = await input.inputValue()
  expect(value, `${label} should reject non-numeric`).not.toContain('abc')
}
```

### B.2 error-injection.ts 骨架

```ts
// e2e/support/error-injection.ts
import { type Page } from '@playwright/test'

export type ErrorKind = '400' | '401' | '403' | '404-biz' | '404-route' | '409' | '422' | '500' | 'offline' | 'slow'

const BODY: Record<ErrorKind, { status: number; body: unknown }> = {
  '400':     { status: 400, body: { code: 'VALIDATION_ERROR', message: '字段不合法', traceId: 'inject' } },
  '401':     { status: 401, body: { code: 'UNAUTHORIZED', message: '未登录' } },
  '403':     { status: 403, body: { code: 'FORBIDDEN', message: '权限不足' } },
  '404-biz': { status: 404, body: { code: 'NOT_FOUND', message: 'queue not found: 999', data: null } },
  '404-route': { status: 404, body: { message: "No static resource api/console/xxx for request '/api/console/xxx'." } },
  '409':     { status: 409, body: { code: 'CONFLICT', message: 'queueCode 已存在' } },
  '422':     { status: 422, body: { code: 'BIZ_INVALID', message: '业务规则失败' } },
  '500':     { status: 500, body: { code: 'SYSTEM_ERROR', message: '系统错误', traceId: 'inject-500' } },
  'offline': { status: 0,   body: null },
  'slow':    { status: 200, body: null }, // 由 fulfill 加延时模拟
}

/** 用 page.route 拦截匹配的 endpoint,注入指定 kind */
export async function injectError(
  page: Page,
  urlMatcher: string | RegExp,
  kind: ErrorKind,
  method: string = 'POST',
) {
  await page.route(urlMatcher, async (route) => {
    if (route.request().method() !== method) return route.continue()
    if (kind === 'offline') return route.abort('failed')
    if (kind === 'slow') {
      await new Promise((r) => setTimeout(r, 12_000))
      return route.continue()
    }
    const { status, body } = BODY[kind]
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
  })
}
```

### B.3 axe 收紧后单 rule disable 模板

```ts
// e2e/a11y.spec.ts (扩展)
import AxeBuilder from '@axe-core/playwright'

const SEVERITY_TO_FAIL = ['critical', 'serious'] as const

const P0_PAGES = [
  '/login', '/governance/queues', '/governance/quota', '/observability/alert-routings',
  '/files/templates', '/files/channels', '/jobs/pipelines', '/system/users',
  '/system/api-keys', '/approvals',
]

for (const route of P0_PAGES) {
  test(`a11y ${route}`, async ({ page }) => {
    await page.goto(route)
    const builder = new AxeBuilder({ page }).withTags(['wcag2aa'])
    // EP 上游已知问题豁免(每条标注 issue link)
    builder.disableRules([
      'color-contrast', // EP el-button plain 在浅色背景对比不足,EP 上游 #14523
      'aria-allowed-attr', // el-table 的 role=cell + aria-describedby 误报
    ])
    const results = await builder.analyze()
    const fails = results.violations.filter((v) => SEVERITY_TO_FAIL.includes(v.impact as any))
    expect(fails, JSON.stringify(fails, null, 2)).toHaveLength(0)
  })
}
```

### B.4 boundary.sh 生成器骨架

```bash
# e2e-data/boundary.sh
# 用法: bash boundary.sh /api/console/queues
# 读 boundary/queues.json,对每字段跑 7 类边界值 → POST → 记录响应
#
# 7 类:min-1 / min / min+1 / max-1 / max / max+1 / null / empty
#
# 用 jq 模板,对每字段构造 7 个 payload,curl 跑,把 status+code 写到表

ENDPOINT="$1"
FIELDS_JSON="boundary/$(basename $ENDPOINT).json"
# ... 生成 7 个 payload * N 字段,跑过 → boundary-report.md
```

---

## 附录 C:已修过的 C 档相关 baseline(B 档顺手做了的)

C 档启动前,B 档联调阶段已经修了这些 C 档级别问题,Day 1 baseline 跑时**应该看不到回归**:

| 问题 | 修复位置 | 备注 |
|---|---|---|
| `interceptors.ts` 把 BizException NOT_FOUND 误报"接口不存在" | `src/api/interceptors.ts` | 用 BizException code 区分 |
| `TagSearchTab.vue` el-autocomplete scoped slot 触发 ce-NPE | 删 scoped slot | 'ce' render error |
| `NotificationChannelsTab.vue` channelTypeOptions 用错枚举组 | 改 `notificationChannelType` 优先 | 通知渠道下拉永远空 |
| `LayoutHeader.vue` locale chip CSS 缺失 → "ENSwitch to English" 粘连 | 加 `.locale-chip-mini` 样式 | 已部署 |
| BE `DataIntegrityViolationException` 误报 500 | 加 handler 转 400 + 字段名 | 用户填错字段不再 500 |
| BE `FileChannelConfigUpsertParam` 缺 id setter → MyBatis 500 | 加 `Long id` 字段 | 文件渠道创建可用 |
| BE file_template / file_channel NOT NULL 字段 BE 不默认 → 500 | service 层补 17+ 字段默认 | 用户不必填隐藏字段 |
| BE `single-session-enabled=true` 阻塞 e2e | local profile 改 false | 测试基建可跑 |
| BE alert-routing UPDATE 不 merge → NULL violation | 加 mergeWithExisting | PATCH 语义正确 |
| BE calendar holiday `bizDate` String→date 不 cast | mapper `#{bizDate}::date` | 节假日 CREATE 不再 500 |

C 档跑出新 baseline 时,**先确认不是这 10 条的回归**再立项。

---

## 附录 D:工具清单

| 已就位 | 版本 | 用途 |
|---|---|---|
| `@playwright/test` | ^1.60 | e2e 主框架 |
| `@axe-core/playwright` | ^4.11 | a11y |
| `devices['Pixel 5']` (内置) | — | mobile viewport(D 档用) |

**Day 1 需新装**:无。所有依赖现有。

---

## 附录 E:产物清单(Done 后应有)

```
e2e/support/
  form-helpers.ts          ← B.1 模板成型
  error-injection.ts       ← B.2 模板成型
e2e/
  a11y.spec.ts             ← 覆盖 P0 10 页(改)
  error-states.spec.ts     ← 新增,P0 写操作 × 错误注入矩阵
  <page>-validation.spec.ts × 10  ← 每 P0 页一份表单子矩阵
e2e-data/
  boundary.sh              ← B.4 生成器
  boundary/*.json          ← P0 5+ endpoint 字段表
docs/runbook/
  fe-qa-c-tier-report.md   ← 最终红绿矩阵
  qa-c-keyboard-report.md  ← 人工抽测结论
  qa-c-baseline.md         ← Day 1 不修先记账
```

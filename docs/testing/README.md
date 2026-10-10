# batch-console 前端测试体系

> 本文是前端测试的**单一权威入口**:测试分层、可复用 helper、可复制的测试案例模板、运行方式、CI 门禁、常见坑。
> 写新测试前**先读「§3 可复用 helper」+「§4 测试案例模板」**,直接套模板,别重造轮子。
> 一条龙上线前验收见 `/fe-acceptance` skill;本文聚焦「怎么写测试 + 体系全貌」。

---

## 1. 测试分层(各层职责 + 何时用)

| 层             | 工具       | 位置                                                               | 验证什么                                                               | 何时写                             |
| -------------- | ---------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------- | ---------------------------------- |
| **单元测试**   | Vitest     | `src/**/*.test.ts`(与被测文件同目录)                               | 纯逻辑:util / composable / api 客户端 / 指令 / 拦截器                  | 关键业务逻辑、防御性代码、复用工具 |
| **e2e**        | Playwright | `e2e/*.spec.ts`                                                    | 真实浏览器 + 真实 BE:页面渲染、4xx/5xx、CRUD、表单校验、RBAC、跳转交互 | 主要用户路径、页面级回归、跨页流程 |
| **e2e 业务流** | Playwright | `e2e/flows/*.spec.ts`(API 序列)、`e2e/flows-ui/*.spec.ts`(UI 序列) | 端到端业务逻辑:触发→实例、配置发布全生命周期、租户复制、文件流水线…    | 跨多页/多接口的真实业务场景        |
| **守护单测**   | Vitest     | 见 §6                                                              | 权限指令 / XSS 兜底 / 租户 ID 校验 / 拦截器防御                        | 安全/防御红线,改一次固化一次       |

测试数量持续变化，不在文档固化瞬时数字；以 `vitest` / `playwright --list` 的实际收集结果为准。

**移动端不写自动化测试**(`src/views-mobile/` 是桌面 API 的轻壳,逻辑复用已被桌面单测覆盖;手势无法稳定复现)。详见根 `AGENTS.md §移动端测试范围`。

---

## 2. 目录与配置

CI 定时任务仅保留有独立漂移/安全价值的低频检查；代码和测试回归由 PR、main 变更触发，避免无代码变更时重复构建。完整策略见后端统一的 [CI 定时治理文档](https://github.com/pinpols/file-batch-system/blob/main/docs/runbook/ci-schedule-governance.md)。

```
e2e/
  support/            # ★ 可复用 helper(写 e2e 必先看)
    fixtures.ts       # test/expect 扩展 + NetworkWatchdog(自动抓 4xx/5xx)
    app.ts            # enterDemoApp / isVisible / clickTableAction / expectSuccessToast …
    config.ts         # e2e/config.cjs 的类型化入口；服务地址默认值只在 e2e/test-config.json 维护
    storage.ts        # 使用应用权威 STORAGE_KEYS 的浏览器存储读写 helper
    form-helpers.ts   # 表单:openDialog / submitForm / expectRequiredBlocked / expectMaxLength …
    crud-smoke.ts     # readOnlyPageSmoke(只读页一键冒烟)
    error-injection.ts# injectError / runErrorMatrix(注入 4xx/5xx/超时 验错误态)
  global-setup.cjs    # 每轮跑:登录、幂等准备 4 角色账号、刷新 storageState、seed ta/tb/tc
  global-teardown.cjs # 按 prefix=e2e 清测试脏数据
  .auth/              # storageState(user.json + role-*.json),global-setup 写入
  *.spec.ts           # 顶层 spec
  flows/ flows-ui/    # 业务流 spec
src/**/*.test.ts      # 单测
playwright.config.cjs # 从 e2e/config.cjs 读取 baseURL / reuseExistingServer / storageState / 重试
vite.config.ts        # test{} 块 = vitest 配置(node env / element-plus inline / coverage)
scripts/
  test-unit.sh test-e2e.sh check-api-drift.sh check-i18n-messages.mjs
  local/fe-acceptance.sh   # 一条龙验收 wrapper
```

### 测试配置事实来源

- 应用持久化键由 `src/constants/storageKeys.json` 唯一维护；应用代码从 `src/constants/storageKeys.ts` 引用，Playwright 通过 `e2e/support/storage.ts` 的 `seedBrowserStorage` / `readBrowserStorage` 操作。改动时同步应用事实源和调用方，不在测试内复制字符串。`src/constants/storageKeys.test.ts` 是兼容性契约测试，字面量是有意保留的预期值。
- E2E 前端、API、Orchestrator、MockServer、Prometheus、Alertmanager 地址由 `e2e/test-config.json` 提供默认值，并通过 `E2E_BASE_URL`、`BC_API_BASE`、`BATCH_ORCHESTRATOR_BASE_URL`、`MOCKSERVER_BASE_URL`、`E2E_PROMETHEUS_URL`、`E2E_ALERTMANAGER_URL` 覆盖。Playwright 配置、setup/teardown、storage-state 生成器和测试统一经过 `e2e/config.cjs` / `e2e/support/config.ts` 读取。
- 场景数据不是平台配置：租户样例、分页边界、业务状态、请求体和断言值按测试目的保留在测试内，不要求抽成配置。
- `npm run check:test-fixture-sources` 以 TypeScript AST 检查测试重复定义应用持久化键、内联 localStorage 桩，以及重复写平台服务 origin（包括带插值的模板字符串）。动态临时服务端口和业务场景数据允许保留；契约预期和外部服务地址也不属于该门禁范围。
- 门禁纳入 `verify-governance.sh`，由 PR 与 Full Gate 调用；本地 `preflight:changed` 在应用/测试、Playwright 配置、事实源或门禁脚本变更时运行。

```ts
// 正确：引用应用持久化键并复用共享 seed helper
await seedBrowserStorage(page, { locale: 'zh-CN', tenantId: 'ta' })

// 错误：测试复制应用键，应用改名后测试会与实现漂移
await page.addInitScript(() => localStorage.setItem('batch-console:locale', 'zh-CN'))
```

---

## 3. 可复用 helper(写测试前先查这里)

### 3.1 `e2e/support/app.ts`

| helper                               | 签名                    | 用途                                                                                                               |
| ------------------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `enterDemoApp(page)`                 | `(Page)=>Promise<void>` | 进入已登录的 app(走 storageState),并断言落在 `/ops/summary`;**被重定向到 /login 会抛「storageState 过期」**(见 §7) |
| `isVisible(locator, timeout=3000)`   | `=>Promise<boolean>`    | 替代啰嗦的 `.isVisible({timeout}).catch(()=>false)`;**条件分支/skip 守卫**用它                                     |
| `gotoAndAssertRoute(page, route)`    |                         | 跳转 + 断言 URL + 页面标题                                                                                         |
| `expectPageTitle(page, title)`       |                         | 断言页标题(含被 router guard 弹回控制面板的明确报错)                                                               |
| `clickTableAction(...)`              |                         | 点表格行操作按钮(含 More 折叠兜底),返回是否点到                                                                    |
| `expectSuccessToast(page, text)`     |                         | 断言成功 toast                                                                                                     |
| `getFirstCellLinkId(page, listPath)` |                         | 取列表首行链接 id(进详情用)                                                                                        |
| `smokeRoutes`                        | `RouteCheck[]`          | 全站冒烟路由表                                                                                                     |

### 3.2 `e2e/support/form-helpers.ts`(抽屉/弹窗表单)

`openDialog` / `submitForm` / `cancelDialog` / `expectRequiredBlocked`(必填拦截)/ `expectMaxLength` / `expectNumericRejection` / `fieldInput` / `expectFormResetOnReopen`。

### 3.3 `e2e/support/error-injection.ts`(错误态)

`injectError(page, urlMatcher, kind)` / `clearInjection` / `runErrorMatrix(...)`,`ErrorKind` 含 4xx/5xx/timeout/malformed。用于验「接口出错时 UI 不白屏、有重试态」。

### 3.4 `e2e/support/crud-smoke.ts`

`readOnlyPageSmoke(page, opts)` —— 只读页一键冒烟(渲染 + 查询 + 零服务端错误)。

### 3.5 `e2e/support/fixtures.ts`

扩展的 `test`/`expect` 自带 **NetworkWatchdog**:测试期间任何 4xx/5xx 响应都会被记录,**无需每个 spec 手写抓 4xx/5xx**。

---

## 4. 测试案例模板(复制即用)

> 所有 e2e 一律 `import { test, expect } from './support/app'`(拿到带 watchdog 的 fixture)。
> **容忍策略**:仅依赖可选业务数据的场景允许用 `test.skip(true, '原因')`;BE 未启动、登录失败、RBAC 账号准备失败属于联测基础设施错误,必须 fail,不得用 skip 掩盖覆盖缺口。

### 4.1 只读页冒烟

```ts
import { test, expect } from './support/app'
import { enterDemoApp } from './support/app'
import { readOnlyPageSmoke } from './support/crud-smoke'

test.describe('XXX 列表', () => {
  test.beforeEach(({ page }) => enterDemoApp(page))
  test('渲染 + 查询 + 零服务端错误', async ({ page }) => {
    await readOnlyPageSmoke(page, { path: '/xxx/list', title: /标题/ })
  })
})
```

### 4.2 CRUD(新建 → 编辑 → 删除)

```ts
import { test, expect } from './support/app'
import { enterDemoApp, isVisible, expectSuccessToast } from './support/app'
import { openDialog, submitForm, expectRequiredBlocked } from './support/form-helpers'

test('新建 XXX → 校验必填 → 提交 → toast', async ({ page }) => {
  await enterDemoApp(page)
  await page.goto('/xxx/list')
  const dialog = await openDialog(page, { name: /新建/ })
  await expectRequiredBlocked(dialog) // 必填拦截
  await dialog.getByLabel('名称').fill(`e2e-xxx-${Date.now()}`) // 命名带 e2e 前缀,teardown 自动清
  await submitForm(dialog)
  await expectSuccessToast(page, /成功/)
})
```

### 4.3 表单校验矩阵

```ts
import { expectMaxLength, expectNumericRejection } from './support/form-helpers'
// 在打开的 dialog 上:
await expectMaxLength(dialog, '描述', 512)
await expectNumericRejection(dialog, '超时秒数')
```

### 4.4 错误态(注入 4xx/5xx)

```ts
import { injectError, runErrorMatrix } from './support/error-injection'
await injectError(page, '/api/console/xxx', '500')
await page.goto('/xxx/list')
await expect(page.locator('.error-state, .el-result')).toBeVisible() // 有错误态,不白屏
```

### 4.5 RBAC(角色可见性)

用 `e2e/.auth/role-*.json` 切换 storageState;global-setup 会幂等查找或创建 admin/tenantAdmin/auditor/tenantUser/user 五类账号,校正角色与启用状态,必要时完成重置密码和首次改密。角色准备失败会终止 suite,RBAC 矩阵不得条件跳过。参考 `e2e/rbac-matrix.spec.ts` / `rbac-denial.spec.ts`。

### 4.6 跨页业务流

- API 序列:`e2e/flows/*.spec.ts`(如 `09-config-release-lifecycle`、`10-tenant-copy`)。
- UI 序列:`e2e/flows-ui/*.spec.ts`(如 `01-trigger-instance-ui`)。

### 4.7 ★ 设计器(X6,绕原生 DnD)—— 见 `e2e/workflow-designer-save-flow.spec.ts`

**原生 HTML5 DnD,Playwright 驱不动**,所以**不要**靠拖拽建图。可靠做法:

- 借**既有合法 workflow** 进设计器 + 工具栏「自动布局」改图(`store.moveNode` → dirty 但仍合法),或「模板/快速节点」(`store.addNode`/`store.reset`)落图;
- `beforeEach` 里**主动释放设计锁**(锁按会话持有,跨运行不释放,否则撞「只读」被 skip):
  ```ts
  for (let id = 1; id <= 15; id++)
    await page.request
      .delete(`/api/console/workflow-definitions/${id}/lock?tenantId=ta`, {
        headers: { 'X-Tenant-Id': 'ta', 'Idempotency-Key': `e2e-rellock-${id}-${Date.now()}` },
      })
      .catch(() => 0)
  ```
- 保存走 `graphToDefinition → PUT /full`,刷新后断言节点数不变(持久化往返)。

### 4.8 断言深度模式(flows-ui 深化经验,稳健不 flaky)

让 UI 业务流既"深"又不依赖具体 seed 数据:

- **数据视图真渲染(行 or 空态)**,而非仅 `toBeAttached`:
  ```ts
  const LIST_OR_EMPTY = 'tbody tr.el-table__row, .el-table__empty-block, .el-empty, .empty-state'
  await expect(page.locator(LIST_OR_EMPTY).first()).toBeVisible({ timeout: 10_000 })
  ```
- **页面真到位**:每步 `await expect(page).toHaveURL(/\/path/)` —— 验未被路由 menu-allowlist 守卫弹回(本项目真实 bug 类)。
- **tab 切换验真激活**,**不要**切完去断 `LIST_OR_EMPTY.first()`——多 tab pane 下 `.first()` 会命中**隐藏**的非激活 pane(`display:none`)→ `toBeVisible` 失败:
  ```ts
  await deliveryTab.click({ force: true })
  await expect(deliveryTab).toHaveAttribute('aria-selected', 'true') // el-tabs 激活态
  ```
- **数据相关交互保持 best-effort**:`if (await isVisible(btn)) { ... }`,有数据才点;别硬断言某行/某按钮存在(seed 波动会 flaky)。

---

## 5. 运行方式

```bash
# 单测
npm run test:unit            # 全量(CI 也跑)
npm run test:unit:watch

# e2e(默认 BE 在 18080 + dev/preview 在 5173；隔离环境用 BC_API_BASE/E2E_BASE_URL 指定两端)
npm run test:e2e             # 常规套件，排除 @slow
npm run test:e2e:all         # 发布验收全量套件，包含 @slow
npm run test:e2e:smoke       # 冒烟三件套(smoke/cross-navigation/navigation)
npm run test:e2e:monitoring:real # 真实 Prometheus/Alertmanager + Console 告警页面联测(需先启动本地观测栈和后端)
npm run test:e2e:ui          # Playwright UI 模式调试
npx playwright test e2e/xxx.spec.ts --reporter=list   # 单 spec

# 静态门禁
npm run typecheck            # vue-tsc
npm run lint:check           # eslint(0 error)
npm run check:i18n           # zh/en key 1:1
npm run gen:api:check        # BE OpenAPI 漂移

# 无后端本地完整门禁(治理→静态检查→覆盖率→build→size→audit)
npm run verify:local

# 真实环境上线前验收(治理→覆盖率→build→e2e→preview→真实使用审计)
bash scripts/local/fe-acceptance.sh           # 或 /fe-acceptance
bash scripts/local/fe-acceptance.sh --skip-e2e-full
```

隔离端口重跑使用率、AI 与降级关联套件时，前端 dev proxy 应指向同一个 Console API；全局准备和清理均用 `BC_API_BASE`，浏览器用 `E2E_BASE_URL`：

```bash
BC_API_BASE=http://127.0.0.1:18089 E2E_BASE_URL=http://127.0.0.1:5175 \
  npx playwright test e2e/usage-ai-degradation.spec.ts --project=chromium --workers=1 --retries=0
```

全局准备会登录内置 admin 并按需准备测试租户及角色账号；如多个实例共享数据库，重新登录可能使同一账号的其他会话失效。需要保留现场时可显式设置 `BC_E2E_SKIP_TEARDOWN=1`，但不能据此宣称已完成测试数据清理。`E2E_SKIP_GLOBAL_SETUP=1` 只适用于自行登录的 opt-in 用例；普通套件跳过准备会使用过期的 `e2e/.auth/*.json`。

真实告警监控联测使用 `e2e/monitoring-platform-real.spec.ts`，不拦截或 mock Console API：检查 Prometheus 已加载可用性/事件规则、Alertmanager 接收器配置，并通过浏览器验证事件目录、告警列表、通知渠道/订阅/投递日志 API。默认地址来自 `e2e/test-config.json`；可分别用 `E2E_PROMETHEUS_URL`、`E2E_ALERTMANAGER_URL`、`BC_API_BASE` 和 `E2E_BASE_URL` 覆盖。非 loopback 目标必须显式设置 `E2E_MONITORING_ALLOW_REMOTE=1`。该专项 setup 仅登录生成浏览器态，不导入配置包、创建角色账号或执行全局清理。若本机 5173 被其他工作树占用，可把当前前端启动在 5174 并设置 `E2E_BASE_URL=http://127.0.0.1:5174`。运行：

```bash
npm run test:e2e:monitoring:real
```

平台级 Prometheus 规则由 Docker/Helm 配置管理，不提供租户级前台编辑；事件目录是只读契约目录。通知渠道和订阅规则在“通知与投递”维护。告警列表验证读取 `alert_event`，不能据此宣称 Prometheus firing 已投递到真实外部收件端；真实收件端送达仍需按后端 [`observability-stack.md`](../../../file-batch-system/docs/runbook/observability-stack.md) 演练。

当前本地 `ta/tb/tc` 的作业配置不等于 `batch.tenant` 中存在对应租户实例。使用率切租户迟到响应用例仅模拟租户候选和汇总行，验证前端不会回填旧租户数据；真实页头切换验收需要后端租户列表确实返回至少两个业务租户。不要把此用例当成真实租户目录联测。

AI 会话正向联测使用 `e2e/ai-live-persistence.spec.ts`，默认跳过。运行前需单独启动已开启 AI 与持久化、且 `bypass-mode=false` 的后端；可使用仅返回固定答案的本地 OpenAI-compatible 模型桩，不要求外部模型密钥。将前端 dev proxy 指向该后端，并在环境变量中提供 `E2E_AI_USERNAME`、`E2E_AI_PASSWORD`，再运行：

```bash
E2E_AI_LIVE=1 E2E_SKIP_GLOBAL_SETUP=1 E2E_BASE_URL=http://127.0.0.1:5174 \
  npx playwright test e2e/ai-live-persistence.spec.ts --workers=1
```

此用例自行登录并先确认缺少 CSRF 头会得到 403，然后验证会话创建、刷新恢复和删除；通过不代表外部 provider、预算或跨租户链路已验收。

AI 会话隔离使用 `e2e/ai-live-isolation.spec.ts`，同样需要启用持久化、关闭 bypass 的本机 Console API 与 PostgreSQL。提供 `E2E_AI_USERNAME/PASSWORD` 和 `BATCH_PLATFORM_DB_USERNAME/PASSWORD`，用 `E2E_AI_ISOLATION=1` 启用。用例验证列表不泄露非本人/其他租户会话，历史和续写返回 `404/NOT_FOUND`，并清理临时记录；不调用模型，不代替外部 provider 验收。

移动端真实降级联测使用 `e2e/degradation-live-mobile.spec.ts`，默认跳过。需将前端 dev proxy 指向本机 Console API，并确认其 Trigger 下游不可用、`/scheduler/status` 返回 `X-Degraded-Source: trigger`：

```bash
E2E_REAL_DEGRADATION=1 E2E_SKIP_GLOBAL_SETUP=1 E2E_BASE_URL=http://127.0.0.1:5175 \
  E2E_DEGRADATION_USERNAME=admin E2E_DEGRADATION_PASSWORD='<password>' \
  npx playwright test e2e/degradation-live-mobile.spec.ts --project=chromium --workers=1
```

用例验证移动布局主动探测和降级横幅；不代替真实 Trigger 恢复验收。

移动端受控下游恢复联测使用 `e2e/degradation-live-recovery.spec.ts`，默认跳过。隔离 Console API 必须关闭安全 bypass，设置 `BATCH_TRIGGER_BASE_URL=http://127.0.0.1:18181`，启动时保证该端口空闲；前端 dev proxy 指向隔离 API。测试先确认真实后端返回 `X-Degraded-Source: trigger`，再自行启动本机 HTTP 桩并验证恢复响应和横幅过期：

```bash
E2E_DEGRADATION_RECOVERY=1 E2E_SKIP_GLOBAL_SETUP=1 E2E_BASE_URL=http://127.0.0.1:5175 \
  E2E_DEGRADATION_USERNAME=admin E2E_DEGRADATION_PASSWORD='<password>' \
  npx playwright test e2e/degradation-live-recovery.spec.ts --project=chromium --workers=1 --retries=0
```

可用 `E2E_TRIGGER_STUB_PORT` 改桩端口，须与后端 `BATCH_TRIGGER_BASE_URL` 一致。此测试不启动真实 Trigger，不验证调度任务恢复。

真实 Trigger 恢复联测使用 `e2e/degradation-live-real-trigger.spec.ts`，默认跳过。先构建配对后端的 `batch-trigger` 可执行 JAR；另启关闭安全 bypass 的隔离 Console API，将 `BATCH_TRIGGER_BASE_URL` 设为 `http://127.0.0.1:18181`，并将隔离前端 dev proxy 指向该 API。运行前确认 18181 未被占用，本机 PostgreSQL 管理账号有 `CREATEDB` 权限，应用账号可拥有新数据库；用例只允许连接 loopback PostgreSQL，不复用现有业务库。提供 Console 登录账号、本机数据库管理账号和应用账号：

```bash
E2E_REAL_TRIGGER_RECOVERY=1 E2E_SKIP_GLOBAL_SETUP=1 E2E_BASE_URL=http://127.0.0.1:5175 \
  E2E_REAL_TRIGGER_JAR='../file-batch-system/batch-trigger/target/batch-trigger-1.0.0-exec.jar' \
  E2E_DEGRADATION_USERNAME=admin E2E_DEGRADATION_PASSWORD='<password>' \
  E2E_TRIGGER_DB_ADMIN_USERNAME='<db-admin>' E2E_TRIGGER_DB_ADMIN_PASSWORD='<db-admin-password>' \
  BATCH_PLATFORM_DB_USERNAME='<db-app>' BATCH_PLATFORM_DB_PASSWORD='<db-app-password>' \
  npx playwright test e2e/degradation-live-real-trigger.spec.ts --project=chromium --workers=1 --retries=0
```

默认 PostgreSQL 地址 `127.0.0.1:15432`、Trigger 端口 `18181`；可用 `E2E_TRIGGER_DB_HOST/PORT` 和 `E2E_REAL_TRIGGER_PORT` 改本机端口，后者必须与隔离 Console API 的 `BATCH_TRIGGER_BASE_URL` 一致。用例创建随机 `e2e_trigger_*` 数据库并启动真实 Trigger，验证初始降级、调度状态 `STARTED`、恢复响应和移动横幅过期消失；无论通过或失败，先停服务再删测试库。它不验证已有作业执行或生产环境恢复。

使用率页面与 PostgreSQL 的只读对账使用 `e2e/usage-live-reconciliation.spec.ts`，默认跳过。测试窗口内需要有 `ta` 聚合数据；提供本机数据库账号后运行：

```bash
E2E_USAGE_DB_RECONCILIATION=1 E2E_SKIP_GLOBAL_SETUP=1 E2E_BASE_URL=http://127.0.0.1:5173 \
  E2E_USAGE_USERNAME=admin E2E_USAGE_PASSWORD='<password>' \
  BATCH_PLATFORM_DB_USERNAME='<db-user>' BATCH_PLATFORM_DB_PASSWORD='<db-password>' \
  npx playwright test e2e/usage-live-reconciliation.spec.ts --project=chromium --workers=1
```

数据库地址默认 `127.0.0.1:15432/batch_platform`，可用 `E2E_USAGE_DB_HOST/PORT/NAME` 和 `PSQL_BIN` 调整，但不接受远程数据库。用例验证 API、数据库和页面读数一致；不证明业务终态或聚合事件去重正确。

---

## 6. 守护测试 / 运行期 Guard(安全红线,改路径要确认没被绕过)

| 测试/Guard                                 | 拦截                                                       |
| ------------------------------------------ | ---------------------------------------------------------- |
| `src/directives/permission.test.ts`        | 权限指令 8 case                                            |
| `src/directives/safeHtml.test.ts`          | XSS 兜底(script/on*/javascript: URL)                       |
| `src/utils/tenantIdValidator.test.ts`      | 租户 ID 校验与 BE ReservedPrefixGuard 对齐                 |
| `src/api/interceptors.integration.test.ts` | 拦截器 401/4xx/blob/token 不泄露                           |
| `vue/no-v-html: error`(eslint)             | 禁原生 v-html,须 `v-safe-html`(DOMPurify)                  |
| `.husky/pre-commit`                        | lint-staged:对 staged 跑 eslint+prettier(禁 `--no-verify`) |

---

## 7. 常见坑 / 排障(本项目实测踩过)

| 症状                                                                   | 根因                                                                                      | 处理                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| e2e 报「storageState token is expired」或角色账号准备失败              | 登录态过期,或脱离 global-setup 直跑(如手写 `chromium.launch + storageState` 的一次性脚本) | **必须走 `npx playwright test` / `npm run test:e2e`** —— 它每次自动准备角色账号并刷新 `e2e/.auth/*.json`;**别用独立脚本直接吃陈旧 storageState**;确认 BE 在 `BC_API_BASE` 指定地址(默认 18080)且 admin/admin123 可登录 |
| `toHaveURL` 断言失败但页面其实正常(如 `/scheduler/catch-up-approvals`) | 该路径是**别名,会重定向**(→ `/approvals?tab=catch-up`)                                    | URL 断言写成接受重定向:`toHaveURL(/\/(scheduler\/catch-up-approvals\|approvals)/)`                                                                                                                                     |
| tab 切换后 `LIST_OR_EMPTY.first()` 报 `Received: hidden`               | 多 tab pane 下 `.first()` 命中**隐藏的非激活 pane**(`display:none`)                       | 切 tab 后改断 `tab` 的 `aria-selected='true'`,别断隐藏 pane 的表(见 §4.8)                                                                                                                                              |
| 设计器 e2e 进去撞「只读 banner」被 skip                                | **设计锁按会话持有,跨运行不自动释放**                                                     | `beforeEach` 主动 DELETE 锁(见 §4.7)                                                                                                                                                                                   |
| 设计器 dev 偶发「View with name 'vue-shape-view' does not exist」      | vite **optimizeDeps 把 x6 系预打包成多实例**(dev-only;prod rollup 单实例无此问题)         | `vite.config optimizeDeps.include` 必须含 `@antv/x6` + `@antv/x6-vue-shape` + `@antv/x6/es/plugin/minimap`;`--force` 重启后**首次**加载可能撞 504 churn,优化器稳定后正常                                               |
| 设计器拖节点崩 `clientToLocalPoint is not a function`                  | X6 v3 公开 API 是 `graph.clientToLocal(x,y)`(`clientToLocalPoint` 仅在 `graph.coord`)     | 已修;新代码用 `clientToLocal`                                                                                                                                                                                          |
| 暗色下白卡                                                             | 组件用了 `var(--color-xxx, #浅色)` 但该 token **未在 `html.dark` 定义**                   | 在 `tokens.css` 的 `:root` + `html.dark` **成对**定义;审计:见本仓 token 缺口扫法                                                                                                                                       |
| 单测报 `Unknown file extension ".css"`                                 | element-plus SFC auto-import 副作用拉 css                                                 | 优先把逻辑抽到 `src/utils/*.ts` 测;非测不可时 vite.config `test.css:false` + `server.deps.inline:[/element-plus/]`(已配)                                                                                               |
| `npm run test:e2e` 全 fail                                             | BE 没起                                                                                   | `cd ../file-batch-system && bash scripts/local/restart.sh console`                                                                                                                                                     |
| 表格行 `.click()` 不触发                                               | 见根 AGENTS.md/记忆:个别场景须原生 `el.click()`                                           | 用 `clickTableAction` helper                                                                                                                                                                                           |

---

## 8. CI 门禁(e2e 不在 PR gate 跑)

| Workflow           | 触发                | 内容                                                           |
| ------------------ | ------------------- | -------------------------------------------------------------- |
| `pr-gate.yml`      | PR / push main      | lint / typecheck / i18n / api-drift / **unit** / build / audit |
| `full-ci-gate.yml` | PR / push main / 每周一 02:00 UTC / 手动 | PR 运行范围适配的静态、单测与安全检查；非 PR 事件再跑 Docker/Trivy + Lighthouse |
| `staging-gate.yml` | tag v* / 手动       | **Playwright 全量 against staging URL** + Lighthouse           |

**关键**:Playwright e2e **只在 staging-gate**(真 staging URL)跑,pr-gate/full-ci **故意不跑**(CI 起 BE 太脆,业界惯例)。e2e 失败 block staging 部署,不 block PR 合并。

---

## 9. 编写约定(摘自根 AGENTS.md §测试约定)

- 框架统一 Vitest,**禁** jest/chai/sinon;`*.test.ts` 与被测文件**同目录**。
- `describe(被测对象短名)`;`it(行为)`,**禁** `should` 前缀。
- mock:顶层 `vi.mock('./client', ...)` → `vi.mocked(get)`;清理用 `beforeEach{ mockReset() }`。
- 需 DOM 顶部加 `// @vitest-environment jsdom`。
- e2e 测试数据**命名带 `e2e` 前缀**(global-teardown 按 prefix 清);非破坏性优先。
- 容忍策略:环境问题 `test.skip(true,'原因')` 不 fail suite。

### 9.1 测试数据与配置来源

- 测试输入依赖平台已有定义时，优先复用生产代码或共享 fixture：持久化键使用 `src/constants/storageKeys.ts`，浏览器存储桩使用 `src/test-utils/localStorage.ts`。主题、语言、页面偏好等功能专属键继续由对应模块维护，不为集中而集中。
- `npm run check:test-fixture-sources` 会扫描 Vitest、Playwright spec、storage-state CJS 和测试脚本，阻止重复写浏览器持久化键、重复写平台前后端服务地址，以及在测试中内联创建 localStorage 桩。浏览器持久化键由 `src/constants/storageKeys.json` 维护，应用模块通过 `src/constants/storageKeys.ts` 派生；Playwright 通过 `e2e/support/storage.ts` 写入和读取。前端/API/Orchestrator 测试地址由 `e2e/config.cjs` 根据 `e2e/test-config.json` 和可覆盖环境变量解析；页面导航优先使用相对路径。新增或调整这些测试、配置源或共享桩时应运行该检查。`src/constants/storageKeys.test.ts` 保留独立字面量，验证已发布键值兼容性。
- 拦截示例：在 `auth.test.ts` 直接写 `storage.set('batch-console-session', '1')`，或再次 `vi.stubGlobal('localStorage', ...)`；应改用 `STORAGE_KEYS.session` 与 `stubLocalStorage()`。放行示例：`storageKeys.test.ts` 将发布过的键值作为独立预期固定下来，或某个测试使用 `tenant-a` 这类仅属于该测试数据的标识。
- 同一测试环境配置被多个测试复用时，放入已有 Vitest setup、共享测试 helper 或测试环境配置；单个测试特有的覆盖值留在测试旁，并说明验证目的。不要复制相同的桩实现或环境默认值。
- 输入数据依赖当前平台定义时，优先引用相应 DTO、枚举、导出常量或公共 fixture，避免平台定义变化后测试输入悄悄过期。
- 契约回归测试必须保留独立预期：持久化键兼容性、API 字段/序列化值、权限边界或公开默认值应明确断言预期，并通过专门测试与生产定义对照。不要让被测实现和期望值读取同一个常量，否则双方同时漂移仍可能通过。
- 不要把所有字符串、状态、角色或测试配置机械搬进全局常量。只有语义稳定、多个测试确实共享且所有者明确的值才抽取；动态键和单项功能专属值留在原模块。
- mock/fixture 只证明隔离层内的行为；引用平台常量不等于真实后端或浏览器验收。按风险选择 Vitest、Playwright 或真实环境验证，并准确描述证据边界。

---

## 10. 已知覆盖与缺口(诚实)

**覆盖好**:CRUD / 列表 / 表单校验 / RBAC / 错误态 / 全站零 4xx-5xx 巡检 / i18n 切换稳定性 / 主要业务流(flows)。

**缺口 / flaky(留 follow-up)**:

- **设计器(X6)**:原生 DnD 测不了,只能走 store/模板/自动布局驱动;save-flow spec 依赖设计锁 + 登录态新鲜,环境不满足时 skip(非 fail)。
- **暗色模式**:已补 token 缺口,但无「全站暗色逐页」自动断言,新增页仍可能引入未定义 token(写 `<style>` 时用 `tokens.css` 已有 token,勿造新的浅色 fallback)。
- **A11y / Lighthouse**:只在 staging-gate 跑,本地不强制。

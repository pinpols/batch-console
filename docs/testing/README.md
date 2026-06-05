# batch-console 前端测试体系

> 本文是前端测试的**单一权威入口**:测试分层、可复用 helper、可复制的测试案例模板、运行方式、CI 门禁、常见坑。
> 写新测试前**先读「§3 可复用 helper」+「§4 测试案例模板」**,直接套模板,别重造轮子。
> 一条龙上线前验收见 `/fe-acceptance` skill;本文聚焦「怎么写测试 + 体系全貌」。

---

## 1. 测试分层(各层职责 + 何时用)

| 层 | 工具 | 位置 | 验证什么 | 何时写 |
|---|---|---|---|---|
| **单元测试** | Vitest | `src/**/*.test.ts`(与被测文件同目录) | 纯逻辑:util / composable / api 客户端 / 指令 / 拦截器 | 关键业务逻辑、防御性代码、复用工具 |
| **e2e** | Playwright | `e2e/*.spec.ts` | 真实浏览器 + 真实 BE:页面渲染、4xx/5xx、CRUD、表单校验、RBAC、跳转交互 | 主要用户路径、页面级回归、跨页流程 |
| **e2e 业务流** | Playwright | `e2e/flows/*.spec.ts`(API 序列)、`e2e/flows-ui/*.spec.ts`(UI 序列) | 端到端业务逻辑:触发→实例、配置发布全生命周期、租户复制、文件流水线… | 跨多页/多接口的真实业务场景 |
| **守护单测** | Vitest | 见 §6 | 权限指令 / XSS 兜底 / 租户 ID 校验 / 拦截器防御 | 安全/防御红线,改一次固化一次 |

**当前规模**:单测 70 个文件;e2e 88 个顶层 spec + 26 个 flows/flows-ui。

**移动端不写自动化测试**(`src/views-mobile/` 是桌面 API 的轻壳,逻辑复用已被桌面单测覆盖;手势无法稳定复现)。详见根 `CLAUDE.md §移动端测试范围`。

---

## 2. 目录与配置

```
e2e/
  support/            # ★ 可复用 helper(写 e2e 必先看)
    fixtures.ts       # test/expect 扩展 + NetworkWatchdog(自动抓 4xx/5xx)
    app.ts            # enterDemoApp / isVisible / clickTableAction / expectSuccessToast …
    form-helpers.ts   # 表单:openDialog / submitForm / expectRequiredBlocked / expectMaxLength …
    crud-smoke.ts     # readOnlyPageSmoke(只读页一键冒烟)
    error-injection.ts# injectError / runErrorMatrix(注入 4xx/5xx/超时 验错误态)
  global-setup.cjs    # 每轮跑:登录刷新 storageState + seed 数据到 ta/tb/tc
  global-teardown.cjs # 按 prefix=e2e 清测试脏数据
  .auth/              # storageState(user.json + role-*.json),global-setup 写入
  *.spec.ts           # 顶层 spec
  flows/ flows-ui/    # 业务流 spec
src/**/*.test.ts      # 单测
playwright.config.cjs # baseURL=5173 / reuseExistingServer / storageState=e2e/.auth/user.json / 重试
vite.config.ts        # test{} 块 = vitest 配置(node env / element-plus inline / coverage)
scripts/
  test-unit.sh test-e2e.sh check-api-drift.sh check-i18n-messages.mjs
  local/fe-acceptance.sh   # 一条龙验收 wrapper
```

---

## 3. 可复用 helper(写测试前先查这里)

### 3.1 `e2e/support/app.ts`
| helper | 签名 | 用途 |
|---|---|---|
| `enterDemoApp(page)` | `(Page)=>Promise<void>` | 进入已登录的 app(走 storageState),并断言落在 `/ops/summary`;**被重定向到 /login 会抛「storageState 过期」**(见 §7) |
| `isVisible(locator, timeout=3000)` | `=>Promise<boolean>` | 替代啰嗦的 `.isVisible({timeout}).catch(()=>false)`;**条件分支/skip 守卫**用它 |
| `gotoAndAssertRoute(page, route)` | | 跳转 + 断言 URL + 页面标题 |
| `expectPageTitle(page, title)` | | 断言页标题(含被 router guard 弹回控制面板的明确报错) |
| `clickTableAction(...)` | | 点表格行操作按钮(含 More 折叠兜底),返回是否点到 |
| `expectSuccessToast(page, text)` | | 断言成功 toast |
| `getFirstCellLinkId(page, listPath)` | | 取列表首行链接 id(进详情用) |
| `smokeRoutes` | `RouteCheck[]` | 全站冒烟路由表 |

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
> **容忍策略**:环境不满足(BE 未起 / 数据未 seed / 锁冲突 / RBAC)用 `test.skip(true, '原因')` —— **跳过不 fail**,别让环境问题红 suite。

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
  await expectRequiredBlocked(dialog)            // 必填拦截
  await dialog.getByLabel('名称').fill(`e2e-xxx-${Date.now()}`)  // 命名带 e2e 前缀,teardown 自动清
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
await expect(page.locator('.error-state, .el-result')).toBeVisible()  // 有错误态,不白屏
```

### 4.5 RBAC(角色可见性)
用 `e2e/.auth/role-*.json`(global-setup 生成 admin/tenantAdmin/auditor/tenantUser/user 五种)切换 storageState;参考 `e2e/rbac-matrix.spec.ts` / `rbac-denial.spec.ts`。

### 4.6 跨页业务流
- API 序列:`e2e/flows/*.spec.ts`(如 `09-config-release-lifecycle`、`10-tenant-copy`)。
- UI 序列:`e2e/flows-ui/*.spec.ts`(如 `01-trigger-instance-ui`)。

### 4.7 ★ 设计器(X6,绕原生 DnD)—— 见 `e2e/workflow-designer-save-flow.spec.ts`
**原生 HTML5 DnD,Playwright 驱不动**,所以**不要**靠拖拽建图。可靠做法:
- 借**既有合法 workflow** 进设计器 + 工具栏「自动布局」改图(`store.moveNode` → dirty 但仍合法),或「模板/快速节点」(`store.addNode`/`store.reset`)落图;
- `beforeEach` 里**主动释放设计锁**(锁按会话持有,跨运行不释放,否则撞「只读」被 skip):
  ```ts
  for (let id = 1; id <= 15; id++)
    await page.request.delete(`/api/console/workflow-definitions/${id}/lock?tenantId=ta`,
      { headers: { 'X-Tenant-Id': 'ta', 'Idempotency-Key': `e2e-rellock-${id}-${Date.now()}` } }).catch(()=>0)
  ```
- 保存走 `graphToDefinition → PUT /full`,刷新后断言节点数不变(持久化往返)。

---

## 5. 运行方式

```bash
# 单测
npm run test:unit            # 全量(CI 也跑)
npm run test:unit:watch

# e2e(需 BE 在 18080 + dev/preview 在 5173)
npm run test:e2e             # 全量 88+ spec(每次自动跑 global-setup 刷新登录态)
npm run test:e2e:smoke       # 冒烟三件套(smoke/cross-navigation/navigation)
npm run test:e2e:ui          # Playwright UI 模式调试
npx playwright test e2e/xxx.spec.ts --reporter=list   # 单 spec

# 静态门禁
npm run typecheck            # vue-tsc
npm run lint:check           # eslint(0 error)
npm run check:i18n           # zh/en key 1:1
npm run gen:api:check        # BE OpenAPI 漂移

# 一条龙上线前验收(依赖→typecheck→lint→i18n→drift→unit→build→e2e→preview→违约扫)
bash scripts/local/fe-acceptance.sh           # 或 /fe-acceptance
bash scripts/local/fe-acceptance.sh --skip-e2e-full
```

---

## 6. 守护测试 / 运行期 Guard(安全红线,改路径要确认没被绕过)

| 测试/Guard | 拦截 |
|---|---|
| `src/directives/permission.test.ts` | 权限指令 8 case |
| `src/directives/safeHtml.test.ts` | XSS 兜底(script/on*/javascript: URL) |
| `src/utils/tenantIdValidator.test.ts` | 租户 ID 校验与 BE ReservedPrefixGuard 对齐 |
| `src/api/interceptors.integration.test.ts` | 拦截器 401/4xx/blob/token 不泄露 |
| `vue/no-v-html: error`(eslint) | 禁原生 v-html,须 `v-safe-html`(DOMPurify) |
| `.husky/pre-commit` | lint-staged:对 staged 跑 eslint+prettier(禁 `--no-verify`) |

---

## 7. 常见坑 / 排障(本项目实测踩过)

| 症状 | 根因 | 处理 |
|---|---|---|
| e2e 全部 `test.skip` / 报「storageState token is expired」 | **登录态 token 过期**(会话/机器闲置久) | 跑 `npm run test:e2e`(会重跑 global-setup 刷新);确认 BE 在 18080 且 admin/admin123 可登录 |
| 设计器 e2e 进去撞「只读 banner」被 skip | **设计锁按会话持有,跨运行不自动释放** | `beforeEach` 主动 DELETE 锁(见 §4.7) |
| 设计器 dev 偶发「View with name 'vue-shape-view' does not exist」 | vite **optimizeDeps 把 x6 系预打包成多实例**(dev-only;prod rollup 单实例无此问题) | `vite.config optimizeDeps.include` 必须含 `@antv/x6` + `@antv/x6-vue-shape` + `@antv/x6/es/plugin/minimap`;`--force` 重启后**首次**加载可能撞 504 churn,优化器稳定后正常 |
| 设计器拖节点崩 `clientToLocalPoint is not a function` | X6 v3 公开 API 是 `graph.clientToLocal(x,y)`(`clientToLocalPoint` 仅在 `graph.coord`) | 已修;新代码用 `clientToLocal` |
| 暗色下白卡 | 组件用了 `var(--color-xxx, #浅色)` 但该 token **未在 `html.dark` 定义** | 在 `tokens.css` 的 `:root` + `html.dark` **成对**定义;审计:见本仓 token 缺口扫法 |
| 单测报 `Unknown file extension ".css"` | element-plus SFC auto-import 副作用拉 css | 优先把逻辑抽到 `src/utils/*.ts` 测;非测不可时 vite.config `test.css:false` + `server.deps.inline:[/element-plus/]`(已配) |
| `npm run test:e2e` 全 fail | BE 没起 | `cd ../file-batch-system && bash scripts/local/restart.sh console` |
| 表格行 `.click()` 不触发 | 见根 CLAUDE.md/记忆:个别场景须原生 `el.click()` | 用 `clickTableAction` helper |

---

## 8. CI 门禁(e2e 不在 PR gate 跑)

| Workflow | 触发 | 内容 |
|---|---|---|
| `pr-gate.yml` | PR / push main | lint / typecheck / i18n / api-drift / **unit** / build / audit |
| `full-ci-gate.yml` | push main / nightly | pr-gate 全套 + Docker/Trivy + Lighthouse |
| `staging-gate.yml` | tag v* / 手动 | **Playwright 全量 against staging URL** + Lighthouse |

**关键**:Playwright e2e **只在 staging-gate**(真 staging URL)跑,pr-gate/full-ci **故意不跑**(CI 起 BE 太脆,业界惯例)。e2e 失败 block staging 部署,不 block PR 合并。

---

## 9. 编写约定(摘自根 CLAUDE.md §测试约定)

- 框架统一 Vitest,**禁** jest/chai/sinon;`*.test.ts` 与被测文件**同目录**。
- `describe(被测对象短名)`;`it(行为)`,**禁** `should` 前缀。
- mock:顶层 `vi.mock('./client', ...)` → `vi.mocked(get)`;清理用 `beforeEach{ mockReset() }`。
- 需 DOM 顶部加 `// @vitest-environment jsdom`。
- e2e 测试数据**命名带 `e2e` 前缀**(global-teardown 按 prefix 清);非破坏性优先。
- 容忍策略:环境问题 `test.skip(true,'原因')` 不 fail suite。

---

## 10. 已知覆盖与缺口(诚实)

**覆盖好**:CRUD / 列表 / 表单校验 / RBAC / 错误态 / 全站零 4xx-5xx 巡检 / i18n 切换稳定性 / 主要业务流(flows)。

**缺口 / flaky(留 follow-up)**:
- **设计器(X6)**:原生 DnD 测不了,只能走 store/模板/自动布局驱动;save-flow spec 依赖设计锁 + 登录态新鲜,环境不满足时 skip(非 fail)。
- **暗色模式**:已补 token 缺口,但无「全站暗色逐页」自动断言,新增页仍可能引入未定义 token(写 `<style>` 时用 `tokens.css` 已有 token,勿造新的浅色 fallback)。
- **A11y / Lighthouse**:只在 staging-gate 跑,本地不强制。

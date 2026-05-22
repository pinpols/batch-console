# batch-console (Frontend)

批量调度系统前端控制台。Vue 3 + TypeScript + Element Plus + Pinia + vue-i18n + TanStack Query。桌面 (`src/views/`) + 移动 (`src/views-mobile/`) 双端,API 类型从配对后端 OpenAPI 生成。

> **维护规则**:本文件只装「不能从代码推断的约束」+「高频违反的红线」+「关键路径指针」。细节去 `docs/`。
>
> 影响本文件已有规范的改动 → 同步 [`docs/changelog.md`](docs/changelog.md)(日期倒序)。Feature / bugfix / 运维 → git commit + PR + 对应 `docs/` 子目录,**不要**写到本文件。
>
> 配对后端约定见 [`../file-batch-system/CLAUDE.md`](../file-batch-system/CLAUDE.md)。

## 配对后端仓库

- 路径:`../file-batch-system`(绝对 `/Users/dengchao/Downloads/file-batch-system`)
- 关键子模块:`batch-console-api`(REST API)/ `batch-orchestrator` / `batch-worker-*` / `db`(schema/migration)
- **联调约定**:验证后端行为直接搜 `../file-batch-system` 的 Controller / DTO / 权限配置,**不要凭空假设**
- 后端 Agent 指南:[`../file-batch-system/CLAUDE.md`](../file-batch-system/CLAUDE.md)(优先阅读)

## 构建 / 测试

| 命令 | 用途 |
|---|---|
| `npm run dev` | Vite dev server (默认 5173) |
| `npm run typecheck` | `vue-tsc --noEmit` |
| `npm run lint` | ESLint + 自动 fix |
| `npm run build` | typecheck + i18n 完整性检查 + Vite 产物 |
| `npm run build:fast` | 只跑 Vite build(本地快速验证用) |
| `npm run test:unit` | Vitest 单测 |
| `npm run test:e2e` | Playwright e2e(全量) |
| `npm run test:e2e:smoke` | smoke 三件套(冒烟 / 跨页 / 导航) |
| `npm run gen:api` | 从 BE OpenAPI 重新生成 `src/types/api.generated.ts` |
| `npm run gen:api:check` | 检测 FE 与 BE OpenAPI 漂移(CI 用) |
| `npm run check:i18n` | 检测 zh / en locale 缺 key |

**改 `src/api/*` 或调接口前**先 `npm run gen:api` 刷新生成类型;CI 漂移检查会 reject 不同步的 PR。

## 目录结构

```
src/
  api/          REST 客户端 + queries(适配后端 console-api)
  components/   通用组件(包含 common/ 表单辅助组件)
  composables/  Vue Composable(useTenantReload / useAsyncAction / usePermission ...)
  layout/       桌面布局
  layout-mobile/ 移动布局(MAppBar / MTabBar / MSearchBar / ActionSheet)
  locales/      vue-i18n 词条(zh-CN / en-US 1:1)
  router/       Vue Router(/ vs /m/ 桌面/移动分流)
  stores/       Pinia(tenant / auth / lastApiMeta)
  styles/       全局 CSS + design token
  types/        手写类型 + api.generated.ts(由 OpenAPI 生成,**禁手改**)
  utils/        通用工具
  views/        桌面页面
  views-mobile/ 移动页面(`/m/*` 路由)
```

## 架构硬约束

- **API 类型**:`src/types/api.generated.ts` 由 `../file-batch-system/docs/api/console-api.openapi.yaml` 生成,**禁手改**;接口变更走 BE OpenAPI → `npm run gen:api` → 用生成的类型
- **API 客户端**:统一走 `src/api/client.ts` 的 `get/post/put/del`;axios 拦截器(auth / tenant / idempotency / response 解包)已配,**不要**自己 new axios 实例
- **租户切换重取**:依赖 `tenant.tenantId` 的视图统一用 `useTenantReload(loadFn)`,**禁**手写 `onMounted + watch(tenant.tenantId)`。TanStack Query 场景把 `tenant.tenantId` 写进 `queryKey` 即可
- **XSS 兜底**:`v-html` 已被 ESLint 禁用(`vue/no-v-html: error`);需 HTML 渲染用 `v-safe-html="content"`(走 DOMPurify);手动 `innerHTML = ...` 先经 `purifyHtml()`(`src/utils/safeHtml.ts`)。**不信任后端是否已转义**
- **认证**:HttpOnly cookie `batch_console_token`(BE 下发),axios `withCredentials: true`。兼容期 Authorization header 由 interceptor 注入(双轨,后续删)

## i18n

- 所有用户可见字符串**必须** `t('namespace.key')`,**禁硬编码** zh/en
- key 命名:页面级 namespace(`pipelineDefinitionList.xxx`),公共词 → `common.xxx`
- zh-CN + en-US **1:1 对齐**;`npm run build` 会跑 `check:i18n` 拦截缺 key

## 移动端测试范围

- **移动端不写自动化测试**(既不写 Vitest 也不写 Playwright):移动视图是桌面 API 的轻量壳,业务逻辑全部复用 stores / api / composables(已有桌面单测覆盖);Playwright 仅在 Desktop Chrome 跑,手势(下拉刷新 / 触屏滚动)无法稳定复现;维护收益 << 重复成本
- **何时要补测**:移动端新增独立于桌面的业务逻辑 → Vitest 单测;移动端独有回归 bug → 单测固化
- **桌面端**:照旧关键业务逻辑 Vitest 覆盖,e2e 覆盖主要用户路径

## 测试约定

**Vitest 单测**(`*.test.ts`):

- 框架统一 Vitest,**禁** jest / chai / sinon。`import { describe, it, expect, vi, beforeEach } from 'vitest'`
- 文件命名 `xxx.test.ts`,**同目录**与被测文件共存(不另开 `__tests__/`)
- `describe(name)` 用**被测对象短名**:函数名(`mapProfileToUserInfo`)/ composable 名(`useTenantReload`)/ 导出对象名(`jobApi` / `instanceApi`)。**禁** `xxx API` / `xxx tests` 等冗余后缀
- `it(desc)` 描述**行为**,**禁** `should ...` 前缀(全仓 0 处);中英不强制(跟同模块现有保持一致 —— API/utils 英文,业务 composable 可中文)
- mock 风格:顶层 `vi.mock('./client', () => ({...}))` → `import { get } from './client'` → `const mockedGet = vi.mocked(get)`。`vi.hoisted` 仅在闭包必需时用(全仓 1 处)
- 需要 DOM 时顶部加 `// @vitest-environment jsdom`(jsdom 已是 devDep)
- 清理 mock 用 `beforeEach { mockReset() }`,不要 `afterEach`
- SFC 测试受 element-plus auto-import .css 链路阻塞,**优先抽业务逻辑到 util 测**;非测不可时 vite.config 加 `server.deps.inline: [/element-plus/]` + `css: false`

**Playwright e2e**(`e2e/*.spec.ts`):见 §移动端测试范围 + `playwright.config.cjs`。

## Vue / TS 编码细则

**以下每条都常被违,写代码前必须先扫一遍**:

| # | 规则 | 反例 |
|---|---|---|
| 1 | 所有用户可见字符串走 `t('...')`,**禁硬编码** zh/en | `<el-button>新建</el-button>` |
| 2 | API 调用走 `src/api/*.ts` 的方法,**禁**组件里直接 `axios.get(...)` | `axios.get('/api/...')` in `.vue` |
| 3 | API 入参 / 出参类型用 `src/types/api.generated.ts` 生成的,**禁手敲** interface | 自己写 `interface UserResp { ... }` |
| 4 | 租户依赖视图用 `useTenantReload(loadFn)`,**禁** `onMounted + watch(tenantId)` 手写 | 手写 `watch(() => tenant.tenantId, ...)` |
| 5 | `v-html` 已 ESLint 禁;HTML 渲染走 `v-safe-html`;`innerHTML =` 走 `purifyHtml()` | `<div v-html="raw">` |
| 6 | 列表分页默认 **15**(`pageSize = ref(15)`),`pageSizes` 含 `[15, 30, 50, 100]` | `pageSize = ref(20)` |
| 7 | 颜色 / 间距走 design token(`var(--color-xxx)` / `var(--space-xx)`),**禁裸 hex / px** | `color: #1890ff` in `<style>` |
| 8 | Element Plus 组件优先,**禁裸 HTML** 实现下拉 / 弹窗 / 表格 | `<select>` / `<dialog>` 原生 |
| 9 | 通用录入用 `src/components/common/` 助手组件(StrongPasswordInput / TenantIdInput / CodeNameBuilder / TraceIdInput) | 重复写密码生成 / 租户校验逻辑 |
| 10 | 文件命名:Vue 组件 `PascalCase.vue`,composable `useXxx.ts`,API 模块 camelCase | `pipeline_list.vue` |

**红线**(违反 = 直接 reject):
- **禁手改** `src/types/api.generated.ts`(由 OpenAPI 生成)
- **禁** 在 `.vue` / `.ts` 文件中加 emoji(除非用户明确要求)
- **禁** `console.log` 留在提交代码里(用 `logger.xxx` 或删)
- **禁** 在组件里写新的 axios 实例(全部走 `src/api/client.ts`)

## 后端 OpenAPI 同步

改后端 `batch-console-api` controller 后:
1. BE 同 PR 更新 `../file-batch-system/docs/api/console-api.openapi.yaml`
2. FE 跑 `npm run gen:api` 刷新 `src/types/api.generated.ts`
3. CI `gen:api:check` 会比对漂移,不一致 reject

## CI(3 个 workflow,对齐 BE)

| Workflow | 触发 | 角色 | 耗时 |
|---|---|---|---|
| `pr-gate.yml` | PR / push main | PR 必过门禁(lint / typecheck / i18n / api-drift / unit / build / audit) | 5-7 min |
| `full-ci-gate.yml` | push main / nightly cron / 手动 | 全量(+ Docker/Trivy + Lighthouse + 完整 audit) | 15-20 min |
| `staging-gate.yml` | tag v* / 手动 | Playwright 82 specs against staging URL + Lighthouse | 10-15 min |

**Playwright e2e 只在 staging-gate 跑**(against 真 staging URL),pr-gate / full-ci 故意不跑(CI 起 BE 太脆,业界 Vercel/Netlify 标准)。完整细则 + secrets / 阈值 / 排查表 → [`docs/runbook/ci.md`](docs/runbook/ci.md)。

## 桌面 vs 移动

- 桌面路由 `/`(`src/views/` + `src/layout/`)
- 移动路由 `/m/*`(`src/views-mobile/` + `src/layout-mobile/`)
- 共享:stores / api / composables / locales / 业务逻辑
- 设备分流由 `src/router/index.ts` 入口逻辑处理(UA / viewport)
- 移动端走 iOS HIG(Liquid Glass / Large Title 塌缩 / 底部 sheet / fill 图标)

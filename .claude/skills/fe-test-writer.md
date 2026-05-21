# FE Test Writer

Generate a Vitest unit test for a FE module following the project's established conventions
(see `CLAUDE.md` §测试约定).

## When to use

- 用户要求「给 X 加单测 / 补测 / 写测试」
- 给新加的 `src/api/*.ts` / `src/composables/*.ts` / `src/utils/*.ts` / `src/directives/*.ts` /
  `src/stores/*.ts` 补回归防线
- 重构前要先固化现有行为

## File location & naming

- **同目录共存**:`src/foo/bar.ts` → `src/foo/bar.test.ts`,**禁** `__tests__/` 子目录
- 命名 `xxx.test.ts`(`spec.ts` 也接受,但 `test.ts` 是事实标准)

## Skeleton (API module)

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fooBar, fooBarApi } from './foo'

vi.mock('./client', () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
}))

import { get, post } from './client'

const mockedGet = vi.mocked(get)
const mockedPost = vi.mocked(post)

describe('fooBarApi', () => {
  beforeEach(() => {
    mockedGet.mockReset()
    mockedPost.mockReset()
  })

  it('list GET with tenantId query', async () => {
    mockedGet.mockResolvedValue({ items: [] })
    await fooBarApi.list('ta')
    expect(mockedGet).toHaveBeenCalledWith('/api/console/foo', { tenantId: 'ta' })
  })

  it('create POST with body', async () => {
    mockedPost.mockResolvedValue(42)
    await fooBarApi.create({ tenantId: 'ta', name: 'x' })
    expect(mockedPost).toHaveBeenCalledWith('/api/console/foo', { tenantId: 'ta', name: 'x' })
  })

  it('encodes path params with special chars', async () => {
    mockedPost.mockResolvedValue('ok')
    await fooBarApi.action('JOB A#1', 'ta')
    expect(mockedPost).toHaveBeenCalledWith(
      '/api/console/foo/JOB%20A%231/action',
      undefined,
      { params: { tenantId: 'ta' } },
    )
  })
})
```

## Skeleton (pure util)

```ts
import { describe, it, expect } from 'vitest'
import { doSomething } from './something'

describe('doSomething', () => {
  it('handles empty input', () => {
    expect(doSomething('')).toBe('')
  })

  it('normalizes whitespace', () => {
    expect(doSomething('  x  ')).toBe('x')
  })

  it('rejects malformed input', () => {
    expect(() => doSomething(null as never)).toThrow()
  })
})
```

## Skeleton (directive — needs DOM)

```ts
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import type { DirectiveBinding } from 'vue'
import { fooDirective } from './foo'

function bind(value: unknown, oldValue?: unknown): DirectiveBinding {
  return { value, oldValue } as DirectiveBinding
}

describe('v-foo directive', () => {
  it('applies value on mount', () => {
    const el = document.createElement('div')
    fooDirective.mounted!(el, bind('hello'), null as never, null)
    expect(el.innerHTML).toContain('hello')
  })
})
```

## Skeleton (composable — pinia setup)

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTenantStore } from '@/stores/tenant'
import { useMyComposable } from './useMyComposable'

vi.mock('@/api/client', () => ({ get: vi.fn() }))

describe('useMyComposable', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('reads tenant id from store', () => {
    const tenant = useTenantStore()
    tenant.tenantId = 'ta'
    const result = useMyComposable()
    expect(result.tenantId.value).toBe('ta')
  })
})
```

## Conventions (locked by CLAUDE.md §测试约定)

1. **框架**:Vitest 唯一,**禁** jest / chai / sinon
2. **import**:`import { describe, it, expect, vi, beforeEach } from 'vitest'`(`globals: true` 也可省,但保留显式 import 防 IDE 警告)
3. **describe 命名**:**被测对象短名**(`jobApi` / `useTenantReload` / `mapProfileToUserInfo`),**禁** `xxx API` / `xxx tests` 等冗余后缀
4. **it 命名**:行为描述,**禁** `should ...` 前缀(全仓 0 处约定);中英不强制(跟同模块现有保持一致)
5. **mock 风格**:
   - 顶层 `vi.mock('./client', () => ({...}))` factory
   - 之后 `import { get } from './client'`
   - 拿类型化引用 `const mockedGet = vi.mocked(get)`
   - **避免** `vi.hoisted`(全仓 1 处特例,driver.js 闭包必需)
6. **mock 清理**:`beforeEach { mockedGet.mockReset(); ... }`,**不用** `afterEach`
7. **DOM 环境**:需要 `document` / `window` / `localStorage` → 文件顶部加 `// @vitest-environment jsdom`(jsdom 已是 devDep)
8. **断言**:Vitest 内置 `expect`,链式 `.toBe / .toEqual / .toContain / .toMatchObject / .toHaveBeenCalledWith`

## SFC 测试(避坑)

**不优先做 SFC 单测**,因为:

- `unplugin-vue-components` + ElementPlusResolver 会在 SFC import 时副作用拉取 `element-plus/.../*.css`,vitest node env 报 `Unknown file extension ".css"`
- 业务逻辑(校验 / 状态机 / 派生值)**优先抽到 `src/utils/*.ts`** 或 `src/composables/*.ts` 测,SFC 只留模板渲染靠 e2e 兜底

如果必须做 SFC 测,vite.config 加:
```ts
test: {
  css: false,
  server: { deps: { inline: [/element-plus/] } },
},
```
并配 `@vue/test-utils`(devDep 已装)。

## 移动端测试范围(`CLAUDE.md` §移动端测试范围)

- 移动端(`src/views-mobile/` + `src/layout-mobile/` + `/m/*` 路由)**不写**自动化测试
- 桌面 API 薄壳的移动视图不写测;移动端新增独立逻辑或独有 bug 才补单测

## 验证

写完跑:
```bash
npx vitest run src/path/to/your.test.ts
```

通过后再 `git add` + commit。**不要**直接 `npm run test:unit`(扫全仓 ~30s,迭代慢)。

## 不要做

- 用 `@vue/test-utils` mount 真 SFC(踩 element-plus auto-import CSS 雷)
- 用 `vi.hoisted` 除非真的闭包必需(全仓 1 处)
- `it('should ...')` 前缀
- `describe('xxx tests')` / `describe('xxx API')` 冗余后缀
- 改 `afterEach` 清 mock(用 `beforeEach.mockReset`)
- 在 test 文件里搞复杂 fixture builder(>20 行就该抽出 `xxx.fixture.ts`)

## Vitest vs Playwright 关系

**两条并行轨,职责不同**:

- **Vitest 单测**:回归防线 + 快速失败(< 30s),粒度 = 函数 / 模块
- **Playwright e2e**(`e2e/*.spec.ts`):用户路径冒烟 + 跨页交互,粒度 = 整页 / 跨页(~12 min)

**实操顺序按场景选**:

| 场景 | 推荐顺序 |
|---|---|
| 新 feature | e2e 主路径 happy path 先(outside-in 验证整体跑通)→ Vitest 补关键逻辑回归 |
| bug fix | Vitest 先复现(< 30s 快迭代)→ 跨页 bug 再补 e2e |
| 防线建设(补缺测) | e2e 已覆盖主路径 → **优先补 Vitest** 把慢路径下沉 |

## 高 ROI 缺测优先级(Vitest 内部)

补 Vitest 时按本顺序选目标(audit 沉淀):**API 模块 → 指令 → utils → composables → stores → SFC**

理由:API 层零防线时业务回归全靠 e2e(慢、脆);指令是 security-critical 兜底;SFC 受 element-plus auto-import 阻塞,ROI 最低优先抽 util。

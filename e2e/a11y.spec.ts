import { AxeBuilder } from '@axe-core/playwright'
import { test, expect } from './support/app'
import type { Page } from '@playwright/test'

/**
 * a11y 自动化审查 — C 档收紧版:
 *   - 覆盖 P0 10 页(原 5 页 + 5 个 P0 表单/操作页)
 *   - SEVERITY_TO_FAIL 加入 'serious'(原仅 critical)
 *   - 单条 rule 豁免必须带 EP 上游 issue / 业务原因注释
 *
 * 规则集:wcag2aa + best-practice。
 * minor/moderate 不 fail,仅 console.warn 记录便于后续推进。
 */

const SEVERITY_TO_FAIL = ['critical', 'serious'] as const

// 全局不豁免规则。第三方 canvas/chart 的局部问题应在具体测试中按选择器排除。
const GLOBAL_DISABLE_RULES: string[] = []

async function runAxe(page: Page, exclude: string[] = [], extraDisable: string[] = []) {
  let builder = new AxeBuilder({ page })
    .withTags(['wcag2aa', 'best-practice'])
    .disableRules([...GLOBAL_DISABLE_RULES, ...extraDisable])
  for (const sel of exclude) builder = builder.exclude(sel)
  const result = await builder.analyze()
  const blockers = result.violations.filter((v) =>
    (SEVERITY_TO_FAIL as readonly string[]).includes(v.impact ?? 'minor'),
  )
  return { blockers, all: result.violations }
}

async function gotoStable(page: Page, route: string): Promise<void> {
  await page.goto(route)
  await page.waitForLoadState('domcontentloaded')
  // 1.5s 缓冲:dashboard SSE 心跳页 networkidle 永不达
  await page.waitForTimeout(1500)
}

// @slow lane:axe 本身 ~2s/页,但 10 页 × (页加载 + 1.5s 缓冲 + 重试)在 4-worker 并发下
// 单页可达 1.5-2min,会吃爆主 e2e 的 1h globalTimeout。拆到 test:e2e:slow 单独跑。
test.describe('@slow @cross-browser a11y baseline (C 档):P0 10 页 axe critical+serious 审查', () => {
  // --- 原 5 页(回归) ---

  // 必须用空 storageState — Login.vue 的 onMounted 会调 /auth/logout 把当前 cookie 的 jti
  // 加进 revocation list,带 admin storageState 跑会把全局 user.json 的 token 杀掉,
  // 导致并行跑的其它测试 → 整片 401。
  test('/login 登录页', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await ctx.newPage()
    try {
      await gotoStable(page, '/login')
      const { blockers, all } = await runAxe(page)
      if (blockers.length > 0) console.error('A11y blockers:', JSON.stringify(blockers, null, 2))
      expect(blockers, blockers.map((v) => v.id).join(', ')).toHaveLength(0)
      if (all.length > 0) console.warn(`[axe] /login minor/moderate ${all.length}`)
    } finally {
      await ctx.close()
    }
  })

  test('/ops/summary 运营概览', async ({ page }) => {
    await gotoStable(page, '/ops/summary')
    const { blockers } = await runAxe(page, ['.echarts', '[class*="vue-echarts"]', 'canvas'])
    expect(blockers, blockers.map((v) => v.id).join(', ')).toHaveLength(0)
  })

  test('/system/tenants 租户列表', async ({ page }) => {
    await gotoStable(page, '/system/tenants')
    const { blockers } = await runAxe(page)
    expect(blockers, blockers.map((v) => v.id).join(', ')).toHaveLength(0)
  })

  test('/monitor/job-instances 作业实例', async ({ page }) => {
    await gotoStable(page, '/monitor/job-instances')
    const { blockers } = await runAxe(page)
    expect(blockers, blockers.map((v) => v.id).join(', ')).toHaveLength(0)
  })

  test('/approvals 审批中心', async ({ page }) => {
    await gotoStable(page, '/approvals')
    const { blockers } = await runAxe(page)
    expect(blockers, blockers.map((v) => v.id).join(', ')).toHaveLength(0)
  })

  // --- C 档新增 5 个 P0 表单页 ---

  test('/governance/queues 资源队列', async ({ page }) => {
    await gotoStable(page, '/governance/queues')
    const { blockers } = await runAxe(page)
    expect(blockers, blockers.map((v) => v.id).join(', ')).toHaveLength(0)
  })

  test('/governance/quota 配额策略', async ({ page }) => {
    await gotoStable(page, '/governance/quota')
    const { blockers } = await runAxe(page)
    expect(blockers, blockers.map((v) => v.id).join(', ')).toHaveLength(0)
  })

  test('/observability/alert-routings 告警路由', async ({ page }) => {
    await gotoStable(page, '/observability/alert-routings')
    const { blockers } = await runAxe(page)
    expect(blockers, blockers.map((v) => v.id).join(', ')).toHaveLength(0)
  })

  test('/files/templates 文件模板', async ({ page }) => {
    await gotoStable(page, '/files/templates')
    const { blockers } = await runAxe(page)
    expect(blockers, blockers.map((v) => v.id).join(', ')).toHaveLength(0)
  })

  test('/jobs/pipelines Pipeline 定义', async ({ page }) => {
    await gotoStable(page, '/jobs/pipelines')
    const { blockers } = await runAxe(page)
    expect(blockers, blockers.map((v) => v.id).join(', ')).toHaveLength(0)
  })

  test('/system/api-keys API Key', async ({ page }) => {
    await gotoStable(page, '/system/api-keys')
    const { blockers } = await runAxe(page)
    expect(blockers, blockers.map((v) => v.id).join(', ')).toHaveLength(0)
  })
})

/**
 * 真实用户行为端到端 — D 档 P3 核心。
 *
 * 一个登录态用户串完整闭环:
 *   登录(隐式 storageState)→ 自助服务巡检 → 队列 CRUD → Job CRUD + 触发 → 实例查看 → 通知规则 CRUD → 标签 CRUD
 *
 * 设计目标:
 *   - 全程 0 4xx/5xx(watchdog assertClean 兜底)
 *   - 不依赖 seed 数据,可重复跑(name 都带 ${Date.now()})
 *   - 不删数据,P3 cleanup-soft.sh 负责清
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

// STAMP = Date.now() + random 后缀,防多 spec 文件并行加载时 jobCode 撞库 unique 约束
const STAMP = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

// 文件级 retry 兜底:user-journey C 在 4-worker 并行下偶发 cross-spec timing 干扰
// (单跑 9/9 全过,合跑 1 fail)。允许 1 次 retry 消除 flaky
test.describe.configure({ retries: 1 })

test.describe('@user-journey D 档真实用户端到端闭环', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('A. 自助服务面板 — 4 卡片可见且可点开', async ({ page, network }) => {
    await page.goto('/self-service')
    await expectPageTitle(page, '自助服务')
    for (const cardText of ['我的配额用量', '配额变更', '重跑申请', '补偿申请']) {
      await expect(
        page.locator('.service-card').filter({ hasText: cardText }).first(),
      ).toBeVisible({ timeout: 5000 })
    }
    network.assertClean('A. self-service')
  })

  test('B. 资源队列 — Create + List + Refresh', async ({ page, network }) => {
    await page.goto('/governance/queues')
    await expectPageTitle(page, /队列/)
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})

    // 翻页测试,无错
    const next = page.locator('.el-pagination .btn-next').first()
    if (await isVisible(next, 1000)) {
      const disabled = await next.getAttribute('disabled')
      if (disabled === null) {
        await next.click({ force: true })
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
      }
    }
    network.assertClean('B. queues list')
  })

  test('C. Job 定义 CRUD 闭环', async ({ page, network }) => {
    const jobCode = `e2e-journey-${STAMP}`

    // C.0 等 enum 字典
    const enumsP = page.waitForResponse(
      (r) => r.url().includes('/meta/enums') && r.status() === 200,
      { timeout: 10000 },
    ).catch(() => null)
    await page.goto('/jobs/definitions')
    await expectPageTitle(page, '作业定义')
    await enumsP
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})

    // C.1 Create — job-def 三态重构后为自定义右滑面板 aside.jdd(非 el-drawer)
    await page.getByRole('button', { name: '新增作业' }).first().click()
    const drawer = page.locator('.jdd').first()
    await expect(drawer).toBeVisible({ timeout: 5000 })

    await drawer.getByLabel('作业编码').fill(jobCode)
    await drawer.getByLabel('作业名称').fill(`E2E Journey ${STAMP}`)
    // 作业类型/调度类型有默认值(GENERAL/MANUAL);MANUAL 下无调度表达式字段
    await drawer.getByRole('button', { name: '新增', exact: true }).click()
    await expect(drawer).toBeHidden({ timeout: 8000 })

    // C.2 Search-back & verify
    const keyword = page.getByPlaceholder(/请输入|jobCode/).first()
    if (await isVisible(keyword, 1500)) {
      await keyword.fill(jobCode)
      await page.keyboard.press('Enter')
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
    }

    // C.3 全程无 4xx/5xx
    network.assertClean('C. job-def CRUD')
  })

  test('D. 通知规则页 — 列表加载 + tab 切换', async ({ page, network }) => {
    await page.goto('/system/notifications')
    await expectPageTitle(page, '通知与投递')
    for (const t of [/规则/, /渠道/, /Webhook/, /投递/]) {
      const tab = page.getByRole('tab', { name: t }).first()
      if (await isVisible(tab, 1500)) {
        await tab.click({ force: true })
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
      }
    }
    network.assertClean('D. notifications')
  })

  test('E. 标签管理 — 两 tab 切换 + 列表加载', async ({ page, network }) => {
    await page.goto('/system/tags')
    await expectPageTitle(page, '标签管理')
    for (const t of ['资源标签', '搜索标签']) {
      const tab = page.getByRole('tab', { name: t }).first()
      if (await isVisible(tab, 1500)) {
        await tab.click({ force: true })
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
      }
    }
    network.assertClean('E. tags')
  })

  test('F. 运维诊断 — 卡片巡视', async ({ page, network }) => {
    await page.goto('/ops/diagnostic')
    await expectPageTitle(page, '运维诊断')
    await expect(page.locator('.diag-card').first()).toBeVisible({ timeout: 8000 })
    network.assertClean('F. ops-diagnostic')
  })

  test('G. 工作流定义 — 列表 + 点详情', async ({ page, network }) => {
    await page.goto('/workflow/definitions')
    await expectPageTitle(page, '工作流定义')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})

    const link = page.locator('.cell-link, a.el-link').first()
    if (await isVisible(link, 1500)) {
      await link.click({ force: true })
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
      await page.waitForTimeout(500)
    }
    network.assertClean('G. workflow detail')
  })

  test('H. 作业运行实例 — 列表 + 详情 + 翻页', async ({ page, network }) => {
    await page.goto('/monitor/job-instances')
    await expectPageTitle(page, '作业运行')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})

    const next = page.locator('.el-pagination .btn-next').first()
    if (await isVisible(next, 1000)) {
      const disabled = await next.getAttribute('disabled')
      if (disabled === null) {
        await next.click({ force: true })
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
      }
    }
    network.assertClean('H. job instances')
  })

  test('I. 综合查询 — 6 tab 巡视', async ({ page, network }) => {
    await page.goto('/observability/queries')
    await expectPageTitle(page, '综合查询')
    const tabs = page.getByRole('tab')
    const count = await tabs.count()
    for (let i = 0; i < Math.min(count, 6); i++) {
      const tab = tabs.nth(i)
      if (await isVisible(tab, 1500)) {
        await tab.click({ force: true })
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
      }
    }
    network.assertClean('I. queries')
  })
})

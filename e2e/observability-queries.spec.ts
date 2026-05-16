import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

test.describe('observability query tabs (可观测性查询)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('可观测性查询页面可打开并展示多个标签页', async ({ page }) => {
    await page.goto('/observability/queries')
    await expectPageTitle(page, '综合查询')
    await expect(page.getByRole('tab', { name: 'Dead Letters' })).toBeVisible()
  })

  test('Dead Letters 标签展示表格与刷新按钮', async ({ page }) => {
    // 默认 tab 改为"执行日志",需点击切换到 Dead Letters
    await page.goto('/observability/queries')
    await page.getByRole('tab', { name: 'Dead Letters' }).click()
    await expect(page.getByRole('tab', { name: 'Dead Letters' })).toHaveClass(/is-active/)
    await expect(page.getByRole('button', { name: '刷新' })).toBeVisible()
  })

  test('各标签可切换', async ({ page }) => {
    await page.goto('/observability/queries')
    const tabs = page.locator('.el-tabs__item')
    const count = await tabs.count()
    for (let i = 0; i < count; i++) {
      await tabs.nth(i).click()
      await expect(tabs.nth(i)).toHaveClass(/is-active/)
    }
  })
})

test.describe('ops summary (运营概览)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('运营概览展示指标卡片网格', async ({ page }) => {
    await page.goto('/ops/summary')
    await expectPageTitle(page, '控制面板')
    await expect(page.locator('.metric-grid')).toBeVisible()
    await expect(page.locator('.metric-hit')).toHaveCount(11)
  })

  test('运营概览展示趋势与分布标签页', async ({ page }) => {
    await page.goto('/ops/summary')
    await expect(page.getByRole('tab', { name: '卡片指标' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '趋势' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '分布' })).toBeVisible()
  })

  test('运营概览各标签可切换', async ({ page }) => {
    await page.goto('/ops/summary')
    await page.getByRole('tab', { name: '趋势' }).click()
    await expect(page.getByRole('tab', { name: '趋势' })).toHaveClass(/is-active/)
    await page.getByRole('tab', { name: '分布' }).click()
    await expect(page.getByRole('tab', { name: '分布' })).toHaveClass(/is-active/)
  })
})

test.describe('alert traceId link (告警 Trace 链接)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('告警列表中 traceId 列为可点击链接', async ({ page }) => {
    await page.goto('/observability/alerts')
    const traceLink = page.locator('td .cell-link[href*="/logs"]').first()
    if (await isVisible(traceLink)) {
      const href = await traceLink.getAttribute('href')
      expect(href).toMatch(/\/logs\?traceId=/)
    }
  })
})

/**
 * 运维诊断 — 2026-05 改版后无 tab,改为诊断卡片列表(diag-card)。
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle } from './support/app'

test.describe('ops diagnostic (运维诊断)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/ops/diagnostic')
    await expectPageTitle(page, '运维诊断')
  })

  test('运维诊断页面可打开并展示诊断卡片', async ({ page }) => {
    // 改版后没 tab,验证存在 diag-card 卡片列表 + 关键文案
    const cards = page.locator('.diag-card')
    await expect(cards.first()).toBeVisible({ timeout: 8000 })
    expect(await cards.count()).toBeGreaterThan(0)
  })

  test('Kafka Lag / Outbox 区块存在', async ({ page }) => {
    await expect(page.getByText(/Kafka Lag|消息积压/).first()).toBeVisible({ timeout: 8000 })
    // 主页面 Outbox 区块文本(排除侧边栏菜单)
    await expect(
      page.locator('.diag-card, main, .page-body').getByText(/Outbox/).first(),
    ).toBeVisible({ timeout: 8000 })
  })

  test('集群诊断区块存在', async ({ page }) => {
    await expect(page.locator('main').getByText(/集群|诊断|节点/).first()).toBeVisible({
      timeout: 8000,
    })
  })

  test('旧路由重定向到运维诊断', async ({ page }) => {
    await page.goto('/ops/toolbox')
    await expect(page).toHaveURL(/\/ops\/diagnostic/)

    await page.goto('/system/cluster-diagnostic')
    await expect(page).toHaveURL(/\/ops\/diagnostic/)
  })
})

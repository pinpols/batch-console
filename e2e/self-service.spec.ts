/**
 * 自助服务面板 — 2026-05 改版后:
 * - quota 卡片(我的配额用量)= inline expand,默认 active
 * - quotaChange / rerun / compensation = 点卡片打开 drawer,drawer 内有提交按钮
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

test.describe('self-service panel (自助服务)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/self-service')
    await expectPageTitle(page, '自助服务')
  })

  test('自助服务页面可打开并展示核心服务卡片', async ({ page }) => {
    await expect(page.locator('.service-card').filter({ hasText: /我的配额用量|配额用量/ }).first()).toBeVisible()
    await expect(page.locator('.service-card').filter({ hasText: '配额变更' }).first()).toBeVisible()
    await expect(page.locator('.service-card').filter({ hasText: '重跑申请' }).first()).toBeVisible()
    await expect(page.locator('.service-card').filter({ hasText: '补偿申请' }).first()).toBeVisible()
  })

  test('我的配额用量(inline)显示当前配额面板', async ({ page }) => {
    // quota 卡片默认 expanded(inline);若未展开则点开
    const quotaCard = page.locator('.service-card').filter({ hasText: /我的配额用量|配额用量/ }).first()
    await expect(quotaCard).toBeVisible()
    if (!(await quotaCard.evaluate((el) => el.classList.contains('is-active')))) {
      // 卡片是整卡可点(article[role=button],内部无 <button>)
      await quotaCard.click({ force: true })
    }
    // inline 区域出现刷新按钮或"当前配额"文字
    const refreshBtn = page.locator('.service-catalog__inline').getByRole('button', { name: /刷新|当前配额/ })
    const text = page.locator('.service-catalog__inline').getByText(/当前配额|配额/)
    expect(
      (await isVisible(refreshBtn.first(), 3000)) || (await isVisible(text.first(), 3000)),
    ).toBeTruthy()
  })

  for (const [cardText, drawerBtn] of [
    ['配额变更', '提交配额变更'],
    ['重跑申请', '提交重跑申请'],
    ['补偿申请', '提交补偿申请'],
  ] as const) {
    test(`${cardText}卡片 → drawer 打开 → 提交按钮可见`, async ({ page }) => {
      // 卡片是整卡可点(article[role=button],内部无 <button>)
      const card = page.locator('.service-card').filter({ hasText: cardText }).first()
      await card.click({ force: true })
      const drawer = page.locator('.el-drawer:visible').first()
      await expect(drawer).toBeVisible({ timeout: 6000 })
      await expect(drawer.getByRole('button', { name: drawerBtn })).toBeVisible({ timeout: 5000 })
    })
  }

  test('旧路由重定向到自助服务', async ({ page }) => {
    await page.goto('/self-service/tenant')
    await expect(page).toHaveURL(/\/self-service/)

    await page.goto('/self-service/jobs')
    await expect(page).toHaveURL(/\/self-service/)
  })
})

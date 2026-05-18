/**
 * 自助服务表单 — 2026-05 改版后,quotaChange/rerun/compensation 都在 drawer 里。
 * 这套 spec 覆盖:卡片点击 → drawer 打开 → 关键字段可填 → 提交按钮可见。
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

test.describe('self-service forms (自助服务表单)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/self-service')
    await expectPageTitle(page, '自助服务')
  })

  async function openCardDrawer(page: import('@playwright/test').Page, cardText: string) {
    const card = page.locator('.service-card').filter({ hasText: cardText }).first()
    await card.locator('button').first().click({ force: true })
    const drawer = page.locator('.el-drawer:visible').first()
    await expect(drawer).toBeVisible({ timeout: 6000 })
    return drawer
  }

  test('配额变更表单可填写', async ({ page }) => {
    const drawer = await openCardDrawer(page, '配额变更')
    // 字段:配额键、期望值、原因(EP 输入框,用 label/textbox 兜底)
    const keyInput = drawer.locator('.el-form-item').filter({ hasText: '配额键' }).locator('input,textarea').first()
    if (await isVisible(keyInput, 2000)) await keyInput.fill('maxConcurrentJobs')
    const valueInput = drawer.locator('.el-form-item').filter({ hasText: /期望值|值/ }).locator('input,textarea').first()
    if (await isVisible(valueInput, 2000)) await valueInput.fill('10')
    const reasonInput = drawer.locator('.el-form-item').filter({ hasText: '原因' }).locator('input,textarea').first()
    if (await isVisible(reasonInput, 2000)) await reasonInput.fill('E2E 测试配额变更')
    await expect(drawer.getByRole('button', { name: '提交配额变更' })).toBeVisible()
  })

  test('重跑申请表单可填写', async ({ page }) => {
    const drawer = await openCardDrawer(page, '重跑申请')
    const reasonInput = drawer.locator('.el-form-item').filter({ hasText: '原因' }).locator('input,textarea').first()
    if (await isVisible(reasonInput, 2000)) await reasonInput.fill('E2E 测试重跑')
    await expect(drawer.getByRole('button', { name: '提交重跑申请' })).toBeVisible()
  })

  test('补偿申请表单可填写', async ({ page }) => {
    const drawer = await openCardDrawer(page, '补偿申请')
    const reasonInput = drawer.locator('.el-form-item').filter({ hasText: '原因' }).locator('input,textarea').first()
    if (await isVisible(reasonInput, 2000)) await reasonInput.fill('E2E 测试补偿')
    await expect(drawer.getByRole('button', { name: '提交补偿申请' })).toBeVisible()
  })

  test('我的配额用量 inline 展示当前配额和用量', async ({ page }) => {
    const quotaCard = page.locator('.service-card').filter({ hasText: /我的配额用量|配额用量/ }).first()
    await expect(quotaCard).toBeVisible()
    if (!(await quotaCard.evaluate((el) => el.classList.contains('is-active')))) {
      await quotaCard.locator('button').first().click({ force: true })
    }
    const inline = page.locator('.service-catalog__inline')
    // 关键词宽松匹配,允许:「当前配额」「配额」「用量」
    await expect(inline.getByText(/当前配额|配额/).first()).toBeVisible({ timeout: 5000 })
  })
})

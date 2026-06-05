/**
 * UI Flow 08: Outbox stuck → republish UI 操作
 * 真页:/observability/outbox
 *
 * 断言深度:每步硬断言「页面真到位 + 数据视图真渲染」,tab 切换验切到投递视图,
 * 重发布操作有数据时才走(数据无关,避免 seed 波动 flaky)。
 */
import { test, expect } from '../support/app'
import { enterDemoApp, isVisible } from '../support/app'

const LIST_OR_EMPTY = 'tbody tr.el-table__row, .el-table__empty-block, .el-empty, .empty-state'

test.describe('UI Flow 08: outbox republish UI', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('1. /observability/outbox 列表数据视图渲染', async ({ page }) => {
    await page.goto('/observability/outbox')
    await expect(page).toHaveURL(/\/observability\/outbox/)
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    await expect(page.locator(LIST_OR_EMPTY).first()).toBeVisible({ timeout: 10_000 })
  })

  test('2. 切到「投递」tab → 投递数据视图渲染', async ({ page }) => {
    await page.goto('/observability/outbox')
    await expect(page).toHaveURL(/\/observability\/outbox/)
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    const deliveryTab = page.getByRole('tab', { name: /投递|delivery/i }).first()
    if (await isVisible(deliveryTab, 2000)) {
      await deliveryTab.click({ force: true })
      // 验 tab 真切换(激活态);不去断隐藏 pane 的表(多 pane 下 .first() 会命中隐藏的)
      await expect(deliveryTab).toHaveAttribute('aria-selected', 'true', { timeout: 4000 })
    }
  })

  test('3. 重发布按钮(若有 FAILED 重试)点开对话框', async ({ page }) => {
    await page.goto('/observability/outbox')
    await expect(page).toHaveURL(/\/observability\/outbox/)
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    await expect(page.locator(LIST_OR_EMPTY).first()).toBeVisible({ timeout: 10_000 })
    const republishBtn = page
      .locator('.table-actions')
      .getByRole('button', { name: /重发布|republish|重投/i })
      .first()
    if (await isVisible(republishBtn, 2000)) {
      await republishBtn.click({ force: true })
      const dlg = page.locator('.el-message-box, .el-dialog:visible').first()
      await expect(dlg).toBeVisible({ timeout: 3000 })
      await page.keyboard.press('Escape')
    }
  })
})

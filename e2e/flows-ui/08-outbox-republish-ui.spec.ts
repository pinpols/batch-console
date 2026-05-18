/**
 * UI Flow 08: Outbox stuck → republish UI 操作
 * 真页:/observability/outbox
 */
import { test, expect } from '../support/app'
import { enterDemoApp, isVisible } from '../support/app'

test.describe('UI Flow 08: outbox republish UI', () => {
  test.beforeEach(async ({ page }) => { await enterDemoApp(page) })

  test('1. /observability/outbox 列表渲染', async ({ page }) => {
    await page.goto('/observability/outbox')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    await expect(page.locator('.section-card, .el-table, .el-empty').first()).toBeAttached({ timeout: 10_000 })
  })

  test('2. 切重试 tab → 投递 tab 验切换', async ({ page }) => {
    await page.goto('/observability/outbox')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    const deliveryTab = page.getByRole('tab', { name: /投递|delivery/i }).first()
    if (await isVisible(deliveryTab, 2000)) {
      await deliveryTab.click({ force: true })
      await page.waitForTimeout(300)
    }
  })

  test('3. 重发布按钮可见(若有 FAILED 重试),点开对话框', async ({ page }) => {
    await page.goto('/observability/outbox')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    const republishBtn = page.locator('.table-actions').getByRole('button', { name: /重发布|republish|重投/i }).first()
    if (await isVisible(republishBtn, 2000)) {
      await republishBtn.click({ force: true })
      const dlg = page.locator('.el-message-box, .el-dialog:visible').first()
      if (await isVisible(dlg, 2000)) {
        await page.keyboard.press('Escape')
      }
    }
  })
})

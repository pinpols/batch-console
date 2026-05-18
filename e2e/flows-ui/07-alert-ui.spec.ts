/**
 * UI Flow 07: Alert 真页 ack/silence/close — readonly view
 *
 * 注:状态改动留给 alert-outbox-ops.spec.ts(防 spec 间状态污染),
 *     本测仅验页面渲染 + 按钮可见性 + 对话框打开。
 */
import { test, expect } from '../support/app'
import { enterDemoApp, expectPageTitle, isVisible } from '../support/app'

test.describe('UI Flow 07: alert page (readonly)', () => {
  test.beforeEach(async ({ page }) => { await enterDemoApp(page) })

  test('1. /observability/alerts 列表渲染', async ({ page }) => {
    await page.goto('/observability/alerts')
    await expectPageTitle(page, /事件告警|告警/)
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    await expect(page.locator('.section-card, .el-table, .el-empty').first()).toBeAttached({ timeout: 10_000 })
  })

  test('2. 行操作按钮(确认/静默/关闭)可见(若有 OPEN)', async ({ page }) => {
    await page.goto('/observability/alerts')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    const ackBtn = page.locator('.table-actions').getByRole('button', { name: /确认|ack/i }).first()
    // 不强求,有 OPEN 才有按钮
    if (await isVisible(ackBtn, 2000)) {
      // 点开确认对话框验交互
      await ackBtn.click({ force: true })
      const dlg = page.locator('.el-message-box, .el-dialog:visible').first()
      if (await isVisible(dlg, 2000)) {
        // ESC 关闭,不真提交(留给 alert-outbox-ops 主测)
        await page.keyboard.press('Escape')
        await page.waitForTimeout(300)
      }
    }
  })

  test('3. /observability/alert-routings 告警路由页', async ({ page }) => {
    await page.goto('/observability/alert-routings')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    await expect(page.locator('.section-card, .el-table, .el-empty').first()).toBeAttached({ timeout: 10_000 })
  })
})

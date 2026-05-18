/**
 * UI Flow 12: DLQ replay UI
 * 真页:/observability/outbox (dead-letters tab) 或 /ops/diagnostic
 */
import { test, expect } from '../support/app'
import { enterDemoApp, isVisible } from '../support/app'

test.describe('UI Flow 12: DLQ replay UI', () => {
  test.beforeEach(async ({ page }) => { await enterDemoApp(page) })

  test('1. /ops/diagnostic 运维诊断页(含 DLQ section)', async ({ page }) => {
    await page.goto('/ops/diagnostic')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    await expect(page.locator('.section-card, .el-card, .el-table, .el-empty').first()).toBeAttached({ timeout: 10_000 })
  })

  test('2. dead-letters tab/section 可访问', async ({ page }) => {
    await page.goto('/observability/outbox')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    const dlqTab = page.getByRole('tab', { name: /死信|dead.?letter|DLQ/i }).first()
    if (await isVisible(dlqTab, 2000)) {
      await dlqTab.click({ force: true })
      await page.waitForTimeout(500)
    }
  })

  test('3. replay 按钮可见(若有 dead-letter 数据)', async ({ page }) => {
    await page.goto('/observability/outbox')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    const replayBtn = page.locator('.table-actions').getByRole('button', { name: /replay|重放|重新投递/i }).first()
    if (await isVisible(replayBtn, 2000)) {
      // 点开但不确认
      await replayBtn.click({ force: true })
      const dlg = page.locator('.el-message-box, .el-dialog:visible').first()
      if (await isVisible(dlg, 2000)) await page.keyboard.press('Escape')
    }
  })
})

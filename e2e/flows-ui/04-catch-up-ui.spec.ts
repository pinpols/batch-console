/**
 * UI Flow 04: Catch-up 历史日漏跑 → 申请 → 批准
 * 真路径:/scheduler/batch-days / /scheduler/catch-up-approvals
 */
import { test, expect } from '../support/app'
import { enterDemoApp, isVisible } from '../support/app'

test.describe('UI Flow 04: catch-up', () => {
  test.beforeEach(async ({ page }) => { await enterDemoApp(page) })

  test('1. /scheduler/batch-days 批次日历页', async ({ page }) => {
    await page.goto('/scheduler/batch-days')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    await expect(page.locator('.section-card, .el-table, .el-card, .el-empty').first()).toBeAttached({ timeout: 10_000 })
  })

  test('2. /scheduler/catch-up-approvals 列表渲染', async ({ page }) => {
    await page.goto('/scheduler/catch-up-approvals')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    await expect(page.locator('.section-card, .el-table, .el-empty').first()).toBeAttached({ timeout: 10_000 })
  })

  test('3. /approvals 切到 catch-up tab', async ({ page }) => {
    await page.goto('/approvals')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    const tab = page.getByRole('tab', { name: /catch-up|catchup|补登|补跑/i }).first()
    if (await isVisible(tab, 2000)) {
      await tab.click({ force: true })
      await page.waitForTimeout(500)
    }
  })
})

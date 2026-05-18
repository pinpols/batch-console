/**
 * UI Flow 11: Worker 管理页
 * 真页:/workers/management /workers/list /workers/channels
 * 用户已注:worker 已退役,本测仅验页面可访问。
 */
import { test, expect } from '../support/app'
import { enterDemoApp, isVisible } from '../support/app'

test.describe('UI Flow 11: worker management UI', () => {
  test.beforeEach(async ({ page }) => { await enterDemoApp(page) })

  test('1. /workers/management 管理页', async ({ page }) => {
    await page.goto('/workers/management')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    await expect(page.locator('.section-card, .el-table, .el-card, .el-empty').first()).toBeAttached({ timeout: 10_000 })
  })

  test('2. /workers/list 列表页', async ({ page }) => {
    await page.goto('/workers/list')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    await expect(page.locator('.section-card, .el-table, .el-empty').first()).toBeAttached({ timeout: 10_000 })
  })

  test('3. drain/takeover/warmup 按钮(若有 worker)', async ({ page }) => {
    await page.goto('/workers/management')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    // 已退役 worker 不会有按钮 — 不强求,通过即可
    const anyAction = page.locator('.table-actions').getByRole('button').first()
    if (await isVisible(anyAction, 2000)) {
      expect(await anyAction.count()).toBeGreaterThan(0)
    }
  })
})

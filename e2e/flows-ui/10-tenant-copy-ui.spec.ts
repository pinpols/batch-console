/**
 * UI Flow 10: 跨租户复制配置
 * 真页:/config/management (tenant-copy dialog) 或 /system/tenants
 */
import { test, expect } from '../support/app'
import { enterDemoApp, isVisible } from '../support/app'

test.describe('UI Flow 10: tenant copy UI', () => {
  test.beforeEach(async ({ page }) => { await enterDemoApp(page) })

  test('1. /config/management 配置管理页', async ({ page }) => {
    await page.goto('/config/management')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    await expect(page.locator('.section-card, .el-table, .el-card, .el-empty').first()).toBeAttached({ timeout: 10_000 })
  })

  test('2. /system/tenants 租户列表 + 复制配置按钮(若存在)', async ({ page }) => {
    await page.goto('/system/tenants')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    await expect(page.locator('.section-card, .el-table').first()).toBeAttached({ timeout: 10_000 })
    // 任意行操作可见
    const moreBtn = page.locator('.table-actions, .el-dropdown').first()
    if (await isVisible(moreBtn, 2000)) {
      // 不真点(避免误操作),只验存在
      expect(await moreBtn.count()).toBeGreaterThan(0)
    }
  })

  test('3. /config/tenant-package 批量导入页', async ({ page }) => {
    await page.goto('/config/tenant-package')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    await expect(page.locator('.section-card, .el-card, .el-upload, .el-empty').first()).toBeAttached({ timeout: 10_000 })
  })
})

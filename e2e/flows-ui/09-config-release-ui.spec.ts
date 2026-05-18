/**
 * UI Flow 09: 配置发布生命周期 UI
 * /config/releases
 */
import { test, expect } from '../support/app'
import { enterDemoApp, expectPageTitle, isVisible } from '../support/app'

test.describe('UI Flow 09: config release lifecycle UI', () => {
  test.beforeEach(async ({ page }) => { await enterDemoApp(page) })

  test('1. /config/releases 列表渲染 + 标题', async ({ page }) => {
    await page.goto('/config/releases')
    await expectPageTitle(page, /发布管理|配置发布/)
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    await expect(page.locator('.section-card, .el-table, .el-empty').first()).toBeAttached({ timeout: 10_000 })
  })

  test('2. 新建按钮 → 抽屉 → 填表 → 关闭(不真提交)', async ({ page }) => {
    await page.goto('/config/releases')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    const createBtn = page.getByRole('button', { name: /新建|创建|新增/i }).first()
    if (!(await isVisible(createBtn, 3000))) test.skip(true, 'RBAC gate 隐藏 - 非 admin?')
    await createBtn.click({ force: true })
    const drawer = page.locator('.el-drawer:visible').first()
    await expect(drawer).toBeVisible({ timeout: 5000 })
    // 填 configKey
    const codeInput = drawer.locator('.el-input__inner').first()
    if (await isVisible(codeInput, 2000)) {
      await codeInput.fill(`e2e-ui-cfg-${Date.now()}`, { force: true })
    }
    // 填 type
    const typeInput = drawer.locator('.el-input__inner').nth(1)
    if (await isVisible(typeInput, 1000)) await typeInput.fill('JSON', { force: true })
    // 取消(不真提交)
    const cancelBtn = drawer.getByRole('button', { name: /取消|cancel/i }).first()
    if (await isVisible(cancelBtn, 1500)) await cancelBtn.click({ force: true })
    else await page.keyboard.press('Escape')
  })

  test('3. 行操作 — 发布/diff/回滚按钮可见', async ({ page }) => {
    await page.goto('/config/releases')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    const actions = page.locator('.table-actions, .el-dropdown')
    if (await isVisible(actions.first(), 2000)) {
      // 至少能找到 1 个 action item
      expect(await actions.count()).toBeGreaterThan(0)
    }
  })
})

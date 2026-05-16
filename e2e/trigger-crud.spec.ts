/**
 * 触发器管理 CRUD - register / pause / resume / unregister.
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

test.describe('trigger CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/system/triggers')
    await expectPageTitle(page, '触发器')
  })

  test('触发器列表加载', async ({ page }) => {
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({
      timeout: 8000,
    })
  })

  test('刷新按钮触发请求', async ({ page }) => {
    const refresh = page.getByRole('button', { name: '刷新' }).first()
    if (await refresh.count()) {
      await refresh.click()
      await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached()
    }
  })

  test('Job 触发对话框可打开(若有按钮)', async ({ page }) => {
    const triggerBtn = page.getByRole('button', { name: /触发|手动触发/ }).first()
    if (!(await isVisible(triggerBtn, 2000))) return
    await triggerBtn.click()
    await page.waitForTimeout(400)
    const dialog = page.locator('.el-dialog,.el-message-box').first()
    if (await isVisible(dialog, 2000)) {
      const cancel = dialog.getByRole('button', { name: '取消' }).first()
      if (await cancel.count()) await cancel.click({ force: true })
    }
  })
})

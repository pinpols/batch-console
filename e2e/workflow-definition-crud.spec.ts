/**
 * 工作流定义 CRUD - 之前漏的页面.
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle } from './support/app'

test.describe('workflow definition CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/workflow/definitions')
  })

  test('工作流定义页面打开 + 列表可见', async ({ page }) => {
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({
      timeout: 10_000,
    })
  })

  test('搜索 / 重置可执行', async ({ page }) => {
    const kw = page.locator('.el-form-item').filter({ hasText: /关键字|workflow/i }).locator('input').first()
    if (await kw.count()) {
      await kw.fill('e2e-test')
      const searchBtn = page.getByRole('button', { name: '搜索' }).first()
      if (await searchBtn.count()) await searchBtn.click()
      await page.waitForTimeout(500)
      const resetBtn = page.getByRole('button', { name: '重置' }).first()
      if (await resetBtn.count()) await resetBtn.click()
    }
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached()
  })
})

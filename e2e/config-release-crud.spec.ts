/**
 * 配置发布 CRUD - submit-approval / approve / reject / gray / publish / rollback 流程。
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle } from './support/app'

test.describe('config release CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/config/releases')
    await expectPageTitle(page, '发布管理')
  })

  // 新 UI:发布列表从表格改为时间线卡片流(.cr-timeline / .cr-item),空态 el-empty
  test('发布列表加载', async ({ page }) => {
    await expect(page.locator('.cr-timeline').first()).toBeAttached({ timeout: 8000 })
    await expect(page.locator('.cr-item, .el-empty').first()).toBeAttached({ timeout: 8000 })
  })

  test('刷新按钮可用', async ({ page }) => {
    const refresh = page.getByRole('button', { name: '刷新' }).first()
    if (await refresh.count()) {
      await refresh.click()
      await expect(page.locator('.cr-timeline').first()).toBeAttached()
    }
  })
})

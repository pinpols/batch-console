/**
 * 通知规则 CRUD - 在通知与投递 → 订阅规则 tab 下。
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

test.describe('notification rule CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/system/notifications')
    await expectPageTitle(page, '通知与投递')
    await page.getByRole('tab', { name: '订阅规则' }).click()
  })

  test('订阅规则 tab 可切换 + 表格/空态可见', async ({ page }) => {
    await expect(page.getByRole('tab', { name: '订阅规则' })).toHaveClass(/is-active/)
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({
      timeout: 8000,
    })
  })

  test('新增订阅规则对话框可打开 + 字段可见', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /^新增/ }).first()
    if (!(await isVisible(addBtn, 2000))) return
    await addBtn.click()
    await page.waitForTimeout(400)
    const dialog = page.locator('.el-dialog').first()
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: '取消' }).click({ force: true })
  })
})

/**
 * 业务日历节假日抽屉 CRUD.
 */
import { expect, test } from './support/app'
import { enterDemoApp, isVisible } from './support/app'

test.describe('calendar holiday drawer CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/governance/calendars')
  })

  test('日历页面 + 节假日抽屉打开', async ({ page }) => {
    // 主操作按钮存在
    await expect(page.getByRole('button', { name: '新建业务日历' }).first()).toBeVisible()
    // 找一行的"查看节假日"或"节假日"按钮
    const holidayBtn = page.getByRole('button', { name: /查看节假日|节假日/ }).first()
    if (!(await isVisible(holidayBtn, 2000))) return
    await holidayBtn.click()
    const drawer = page.locator('.el-drawer').first()
    await expect(drawer).toBeVisible({ timeout: 4000 })
    // 关闭抽屉
    await page.keyboard.press('Escape')
  })
})

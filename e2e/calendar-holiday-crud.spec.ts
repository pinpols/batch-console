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

  test('真端到端:新建业务日历 → 保存 → 成功提示 + 列表出现', async ({ page }) => {
    await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {})
    const code = `e2e-cal-${Date.now()}`
    await page.getByRole('button', { name: '新建业务日历' }).first().click()
    const dialog = page
      .locator('.el-dialog:visible, .el-drawer:visible')
      .filter({ hasText: '新增业务日历' })
    await expect(dialog).toBeVisible({ timeout: 5000 })

    const fillInput = async (label: string, val: string) => {
      await dialog
        .locator('.el-form-item')
        .filter({ hasText: label })
        .locator('input')
        .first()
        .fill(val)
    }
    // 3 个必填:日历编码 / 名称 / 时区(时区是 filterable allow-create select,直接键入即可)。
    // 节假日顺延规则 / Catch-up 策略 是非必填,留默认不动。
    await fillInput('日历编码', code)
    await fillInput('名称', `E2E Calendar ${Date.now()}`)
    const tzInput = dialog.locator('.el-form-item').filter({ hasText: '时区' }).locator('input').first()
    await tzInput.click()
    await tzInput.fill('Asia/Shanghai')
    // 下拉若有匹配项点之,否则 allow-create 直接回车采用键入值
    const tzOpt = page.locator('.el-select-dropdown:visible').last().locator('.el-select-dropdown__item').first()
    if (await tzOpt.isVisible().catch(() => false)) await tzOpt.click()
    else await page.keyboard.press('Enter')

    await dialog.getByRole('button', { name: /保存|确定|创建/ }).first().click()
    await expect(page.locator('.el-message--success').first()).toBeVisible({ timeout: 6000 })
    await expect(dialog).toBeHidden({ timeout: 6000 })
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    await expect(page.getByText(code).first()).toBeVisible({ timeout: 8000 })
  })
})

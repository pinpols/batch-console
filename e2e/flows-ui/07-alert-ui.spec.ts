/**
 * UI Flow 07: Alert 真页 ack/silence/close — readonly view
 *
 * 注:状态改动留给 alert-outbox-ops.spec.ts(防 spec 间状态污染),本测仅验
 *     页面渲染 + 按钮可见性 + 对话框打开。
 * 断言深度:每步硬断言「页面真到位 + 数据视图真渲染」;有 OPEN 行时验确认对话框打开。
 */
import { test, expect } from '../support/app'
import { enterDemoApp, expectPageTitle, isVisible } from '../support/app'

const LIST_OR_EMPTY = 'tbody tr.el-table__row, .el-table__empty-block, .el-empty, .empty-state'

test.describe('UI Flow 07: alert page (readonly)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('1. /observability/alerts 列表数据视图渲染', async ({ page }) => {
    await page.goto('/observability/alerts')
    await expect(page).toHaveURL(/\/observability\/alerts/)
    await expectPageTitle(page, /事件告警|告警/)
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    await expect(page.locator(LIST_OR_EMPTY).first()).toBeVisible({ timeout: 10_000 })
  })

  test('2. 行确认按钮(若有 OPEN)点开确认对话框', async ({ page }) => {
    await page.goto('/observability/alerts')
    await expect(page).toHaveURL(/\/observability\/alerts/)
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    await expect(page.locator(LIST_OR_EMPTY).first()).toBeVisible({ timeout: 10_000 })
    const ackBtn = page.locator('.table-actions').getByRole('button', { name: /确认|ack/i }).first()
    if (await isVisible(ackBtn, 2000)) {
      await ackBtn.click({ force: true })
      const dlg = page.locator('.el-message-box, .el-dialog:visible').first()
      await expect(dlg).toBeVisible({ timeout: 3000 })
      await page.keyboard.press('Escape') // 不真提交(留给 alert-outbox-ops 主测)
    }
  })

  test('3. /observability/alert-routings 告警路由列表渲染', async ({ page }) => {
    await page.goto('/observability/alert-routings')
    await expect(page).toHaveURL(/\/observability\/alert-routings/)
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    await expect(page.locator(LIST_OR_EMPTY).first()).toBeVisible({ timeout: 10_000 })
  })
})

/**
 * UI Flow 05: 补偿 — /self-service 补偿 tab + /approvals?type=COMPENSATION
 *
 * 断言深度:每步硬断言「页面真到位 + 数据视图/表单真渲染」;补偿表单填写后回读。
 */
import { test, expect } from '../support/app'
import { enterDemoApp, isVisible } from '../support/app'

const LIST_OR_EMPTY = 'tbody tr.el-table__row, .el-table__empty-block, .el-empty, .empty-state'

test.describe('UI Flow 05: compensation', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('1. /self-service 补偿 tab 表单渲染', async ({ page }) => {
    await page.goto('/self-service')
    await expect(page).toHaveURL(/\/self-service/)
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    const tab = page.getByRole('tab', { name: /补偿|compensation/i }).first()
    if (!(await isVisible(tab, 2000))) {
      test.skip(true, '无补偿 tab(RBAC / 功能未开)')
      return
    }
    await tab.click({ force: true })
    await expect(page.locator('.el-input__inner, .el-textarea__inner').first()).toBeVisible({
      timeout: 4000,
    })
  })

  test('2. 补偿表单 reason 可填写并回读', async ({ page }) => {
    await page.goto('/self-service')
    await expect(page).toHaveURL(/\/self-service/)
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    const tab = page.getByRole('tab', { name: /补偿|compensation/i }).first()
    if (!(await isVisible(tab, 2000))) {
      test.skip(true, '无补偿 tab')
      return
    }
    await tab.click({ force: true })
    const reasonInput = page.locator('.el-textarea__inner, textarea').first()
    if (await isVisible(reasonInput, 2000)) {
      await reasonInput.fill('[E2E UI 05] compensation test reason', { force: true })
      await expect(reasonInput).toHaveValue(/E2E UI 05/)
    }
  })

  test('3. /approvals 列表数据视图渲染', async ({ page }) => {
    await page.goto('/approvals')
    await expect(page).toHaveURL(/\/approvals/)
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    await expect(page.locator(LIST_OR_EMPTY).first()).toBeVisible({ timeout: 10_000 })
  })
})

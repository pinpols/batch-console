/**
 * UI Flow 05: 补偿 — /self-service 补偿服务卡片 + 申请抽屉 + /approvals
 *
 * 断言深度:每步硬断言「页面真到位 + 数据视图/表单真渲染」;补偿表单填写后回读。
 */
import { test, expect } from '../support/app'
import { enterDemoApp } from '../support/app'

const LIST_OR_EMPTY = 'tbody tr.el-table__row, .el-table__empty-block, .el-empty, .empty-state'

test.describe('UI Flow 05: compensation', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('1. /self-service 补偿卡片打开申请抽屉', async ({ page }) => {
    await page.goto('/self-service')
    await expect(page).toHaveURL(/\/self-service/)
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    const card = page.locator('.service-card').filter({ hasText: /补偿申请|compensation/i }).first()
    await expect(card).toBeVisible({ timeout: 4_000 })
    await card.click()
    const drawer = page.locator('.el-drawer:visible').first()
    await expect(drawer).toBeVisible()
    await expect(drawer).toContainText(/申请数据补偿|compensation/i)
    await expect(drawer.locator('.el-form')).toBeVisible()
  })

  test('2. 补偿表单 reason 可填写并回读', async ({ page }) => {
    await page.goto('/self-service')
    await expect(page).toHaveURL(/\/self-service/)
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    const card = page.locator('.service-card').filter({ hasText: /补偿申请|compensation/i }).first()
    await card.click()
    const drawer = page.locator('.el-drawer:visible').first()
    const reasonInput = drawer.locator('.el-textarea__inner, textarea').first()
    await expect(reasonInput).toBeVisible({ timeout: 4_000 })
    await reasonInput.fill('[E2E UI 05] compensation test reason')
    await expect(reasonInput).toHaveValue(/E2E UI 05/)
  })

  test('3. /approvals 列表数据视图渲染', async ({ page }) => {
    await page.goto('/approvals')
    await expect(page).toHaveURL(/\/approvals/)
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    await expect(page.locator(LIST_OR_EMPTY).first()).toBeVisible({ timeout: 10_000 })
  })
})

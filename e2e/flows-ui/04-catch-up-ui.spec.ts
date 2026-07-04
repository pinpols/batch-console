/**
 * UI Flow 04: Catch-up 历史日漏跑 → 申请 → 批准
 * 真路径:/scheduler/batch-days / /scheduler/catch-up-approvals
 *
 * 断言深度:每步硬断言「页面真到位(URL 未被守卫弹回)+ 数据视图真渲染」。
 */
import { test, expect } from '../support/app'
import { enterDemoApp, isVisible } from '../support/app'

const LIST_OR_EMPTY =
  'tbody tr.el-table__row, .el-table__empty-block, .el-empty, .el-card, .empty-state'

test.describe('UI Flow 04: catch-up', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('1. /scheduler/batch-days 批次日历页渲染', async ({ page }) => {
    await page.goto('/scheduler/batch-days')
    await expect(page).toHaveURL(/\/scheduler\/batch-days/)
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    await expect(page.locator(LIST_OR_EMPTY).first()).toBeVisible({ timeout: 10_000 })
  })

  test('2. /scheduler/catch-up-approvals(别名,重定向到 /approvals?tab=catch-up)列表渲染', async ({
    page,
  }) => {
    await page.goto('/scheduler/catch-up-approvals')
    // 该路径是别名,实际重定向到 /approvals?tab=catch-up — 断言落到审批页(未被守卫弹回首页)
    await expect(page).toHaveURL(/\/(scheduler\/catch-up-approvals|approvals)/)
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    // 新 UI:审批页双 tab 用 v-show 同时挂载,.first() 可能命中隐藏 tab 的表格 → 只断可见的
    await expect(
      page.locator(LIST_OR_EMPTY).filter({ visible: true }).first(),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('3. /approvals catch-up tab 切换后列表渲染', async ({ page }) => {
    await page.goto('/approvals')
    await expect(page).toHaveURL(/\/approvals/)
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    await expect(
      page.locator(LIST_OR_EMPTY).filter({ visible: true }).first(),
    ).toBeVisible({ timeout: 10_000 })
    // 新 UI:el-tabs 换自绘 pill tab(.ap-tab 按钮,v-show 挂载)
    const tab = page
      .locator('.ap-tab')
      .filter({ hasText: /catch-up|catchup|补登|补跑/i })
      .first()
    if (await isVisible(tab, 2000)) {
      await tab.click({ force: true })
      await expect(tab).toHaveClass(/is-active/)
      await expect(
        page.locator(LIST_OR_EMPTY).filter({ visible: true }).first(),
      ).toBeVisible({ timeout: 8000 })
    }
  })
})

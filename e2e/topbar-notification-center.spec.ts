/**
 * Sprint3-1 顶栏通知中心(layout/components/NotificationCenter.vue)。
 * 顶栏铃铛 → 点开分类面板(待审批 / 严重告警等),替代盲跳。
 * 铃铛挂在 LayoutHeader,任意页面都在;用 /ops/summary 作载体。
 *
 * 稳定 class 选择器:.notif-center__badge(铃铛)/ .notif-center(面板)/
 *   .notif-center__empty(空态)/ .notif-center__row(分类行)。
 */
import { expect, test } from './support/app'
import { enterDemoApp, isVisible } from './support/app'

test.describe('顶栏通知中心', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page) // 落在 /ops/summary
  })

  test('铃铛存在且可点开通知面板', async ({ page }) => {
    const bell = page.locator('.notif-center__badge').first()
    await expect(bell).toBeVisible({ timeout: 10_000 })

    await bell.locator('button').first().click()

    const panel = page.locator('.notif-center')
    await expect(panel).toBeVisible({ timeout: 5_000 })
    await expect(panel).toHaveAttribute('role', 'region')
    // 标题区存在
    await expect(panel.locator('.notif-center__title')).toBeVisible()
    // 要么空态,要么至少一条分类行 —— 二者必居其一
    const empty = panel.locator('.notif-center__empty')
    const rows = panel.locator('.notif-center__row')
    const hasEmpty = await isVisible(empty, 1500)
    if (!hasEmpty) {
      await expect(rows.first()).toBeVisible({ timeout: 3_000 })
    }
  })

  test('有分类行时点击可跳转对应页面', async ({ page }) => {
    const bell = page.locator('.notif-center__badge').first()
    await expect(bell).toBeVisible({ timeout: 10_000 })
    await bell.locator('button').first().click()

    const firstRow = page.locator('.notif-center__row').first()
    if (!(await isVisible(firstRow, 2000))) {
      test.skip(true, '通知面板为空(无待审批/严重告警),无可点击分类行')
    }
    await firstRow.click()
    // 跳到某个内部路由(approvals / alerts 等),URL 离开 ops/summary
    await expect(page).not.toHaveURL(/\/ops\/summary$/, { timeout: 5_000 })
  })
})

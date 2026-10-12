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
    await page.route('**/api/console/ops/summary*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'SUCCESS',
          message: 'ok',
          data: {
            pendingApprovals: 2,
            openAlerts: 1,
            criticalAlerts: 1,
            failedJobs: 1,
          },
        }),
      }),
    )
    await enterDemoApp(page) // 落在 /ops/summary
  })

  test('铃铛存在且可点开通知面板', async ({ page }) => {
    const bell = page.locator('.notif-center__badge').first()
    await expect(bell).toBeVisible({ timeout: 10_000 })
    await expect(bell.locator('.notif-center__new-dot')).toHaveCount(0)
    const badge = bell.locator('.el-badge__content')
    await expect(badge).toBeVisible()

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
      const count = rows.first().locator('.el-tag')
      const arrow = rows.first().locator('.notif-center__chev')
      const countBox = await count.boundingBox()
      const arrowBox = await arrow.boundingBox()
      expect(countBox).not.toBeNull()
      expect(arrowBox).not.toBeNull()
      expect(arrowBox!.x).toBeGreaterThanOrEqual(countBox!.x + countBox!.width)
    }
  })

  test('有分类行时点击可跳转对应页面', async ({ page }) => {
    const bell = page.locator('.notif-center__badge').first()
    await expect(bell).toBeVisible({ timeout: 10_000 })
    await bell.locator('button').first().click()

    const firstRow = page.locator('.notif-center__row').first()
    await expect(firstRow).toBeVisible({ timeout: 5_000 })
    await firstRow.click()
    // 跳到某个内部路由(approvals / alerts 等),URL 离开 ops/summary
    await expect(page).not.toHaveURL(/\/ops\/summary$/, { timeout: 5_000 })
  })

  test('降级横幅支持手动关闭并按倒计时自动关闭', async ({ page }) => {
    await page.clock.install()
    await page.route('**/api/console/ops/summary*', (route) =>
      route.fulfill({
        status: 200,
        headers: { 'X-Degraded-Source': 'trigger' },
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'SUCCESS',
          message: 'ok',
          data: {
            pendingApprovals: 0,
            openAlerts: 0,
            criticalAlerts: 0,
            failedJobs: 0,
          },
        }),
      }),
    )

    await page.reload()
    const banner = page.locator('.degradation-banner')
    await expect(banner).toContainText('15 秒后自动关闭')
    await banner.locator('.auto-dismiss-actions__close').click()
    await expect(banner).toHaveCount(0)

    await page.reload()
    await expect(banner).toBeVisible()
    await page.clock.runFor(15_000)
    await expect(banner).toHaveCount(0)
  })

  test('密码提醒可关闭且按倒计时自动隐藏，不阻断当前页面', async ({ page }) => {
    await page.clock.install()
    await page.route('**/api/console/auth/me*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'SUCCESS',
          message: 'ok',
          data: {
            username: 'admin',
            tenantId: 'system',
            authorities: ['ROLE_ADMIN'],
            mustChangePassword: true,
          },
        }),
      }),
    )

    await page.reload()
    const notice = page.locator('.password-notice')
    await expect(notice).toContainText('15 秒后自动关闭')
    await expect(page).toHaveURL(/\/ops\/summary$/)
    await notice.locator('.auto-dismiss-actions__close').click()
    await expect(notice).toHaveCount(0)

    await page.reload()
    await expect(notice).toBeVisible()
    await page.clock.runFor(15_000)
    await expect(notice).toHaveCount(0)
  })

  test('移动端密码与服务降级提示呈 iOS 通知卡片并错位堆叠', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.route('**/api/console/auth/me*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'SUCCESS',
          message: 'ok',
          data: {
            username: 'admin',
            tenantId: 'system',
            authorities: ['ROLE_ADMIN'],
            mustChangePassword: true,
          },
        }),
      }),
    )
    await page.route('**/api/console/ops/summary*', (route) =>
      route.fulfill({
        status: 200,
        headers: { 'X-Degraded-Source': 'worker' },
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'SUCCESS',
          message: 'ok',
          data: { pendingApprovals: 0, openAlerts: 0, criticalAlerts: 0, failedJobs: 0 },
        }),
      }),
    )

    await page.goto('/m/ops/summary')
    const stack = page.locator('.mobile-notification-stack')
    const degradation = stack.locator('.degradation-banner')
    const password = stack.locator('.password-notice')
    await expect(degradation).toContainText('worker')
    await expect(password).toBeVisible()
    const [stackBox, degradationBox, passwordBox] = await Promise.all([
      stack.boundingBox(),
      degradation.boundingBox(),
      password.boundingBox(),
    ])
    expect(stackBox).not.toBeNull()
    expect(degradationBox).not.toBeNull()
    expect(passwordBox).not.toBeNull()
    expect(stackBox!.x).toBeGreaterThanOrEqual(0)
    expect(stackBox!.x + stackBox!.width).toBeLessThanOrEqual(390)
    expect(passwordBox!.y).toBeGreaterThanOrEqual(degradationBox!.y + degradationBox!.height)
    expect(await degradation.evaluate((el) => getComputedStyle(el).borderRadius)).not.toBe('0px')
    await expect(degradation.locator('.auto-dismiss-actions__close')).toBeVisible()
    await expect(password.locator('.auto-dismiss-actions__close')).toBeVisible()
  })
})

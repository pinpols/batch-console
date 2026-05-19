import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, gotoAndAssertRoute, smokeRoutes } from './support/app'

test.describe('@cross-browser smoke routes (VITE_DEMO_MODE)', () => {
  // 多路由串行 goto + assert 在 dev server 并发压力下需要更长 budget
  test.describe.configure({ timeout: 60_000 })
  test('已登录用户访问根路径自动跳转到控制面板', async ({ page }) => {
    // FE 当前不在 /login 页做 mount-time redirect(只有登录提交后才跳),
    // 所以这条只测根路径 → /ops/summary。
    await page.goto('/')
    await expect(page).toHaveURL(/\/ops\/summary/, { timeout: 30_000 })
    await expectPageTitle(page, '控制面板')
  })

  test('根路径重定向到运营概览', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/ops\/summary/, { timeout: 30_000 })
  })

  test('常见重定向入口可用', async ({ page }) => {
    await page.goto('/files')
    await expect(page).toHaveURL(/\/files\/list/, { timeout: 30_000 })

    await page.goto('/monitor/instances')
    await expect(page).toHaveURL(/\/monitor\/job-instances/, { timeout: 30_000 })

    await page.goto('/alerts')
    await expect(page).toHaveURL(/\/observability\/alerts/, { timeout: 30_000 })

    await page.goto('/404-like-path')
    await expect(page.locator('text=404')).toBeVisible({ timeout: 30_000 })
  })

  for (const route of smokeRoutes) {
    test(`页面可达: ${route.path}`, async ({ page }) => {
      await gotoAndAssertRoute(page, route)
    })
  }
})

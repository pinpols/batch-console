import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, gotoAndAssertRoute, smokeRoutes } from './support/app'

test.describe('smoke routes (VITE_DEMO_MODE)', () => {
  test('已登录用户访问登录页自动跳转到运营概览', async ({ page }) => {
    // Navigate to root first (guaranteed redirect), then verify /login also redirects
    await page.goto('/')
    await expect(page).toHaveURL(/\/ops\/summary/, { timeout: 30_000 })
    await page.goto('/login')
    await expect(page).toHaveURL(/\/ops\/summary/, { timeout: 30_000 })
    await expectPageTitle(page, '运营概览')
  })

  test('根路径重定向到运营概览', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/ops\/summary/)
  })

  test('常见重定向入口可用', async ({ page }) => {
    await page.goto('/files')
    await expect(page).toHaveURL(/\/files\/list/)

    await page.goto('/monitor/instances')
    await expect(page).toHaveURL(/\/monitor\/job-instances/)

    await page.goto('/alerts')
    await expect(page).toHaveURL(/\/observability\/alerts/)

    await page.goto('/404-like-path')
    await expect(page.locator('text=404')).toBeVisible()
  })

  for (const route of smokeRoutes) {
    test(`页面可达: ${route.path}`, async ({ page }) => {
      await gotoAndAssertRoute(page, route)
    })
  }
})

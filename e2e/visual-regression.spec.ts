import { seedBrowserStorage } from './support/storage'
import { expect, test } from '@playwright/test'
import { e2eText, installE2eLocale } from './support/i18n'

test.beforeEach(async ({ page }) => {
  await installE2eLocale(page)
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: '{"code":"UNAUTHORIZED"}',
      }),
  )
  await seedBrowserStorage(page, { theme: 'dark' })
})

test('登录入口视觉基线', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'networkidle' })
  await expect(
    page.getByRole('button', { name: e2eText('login.submit'), exact: true }),
  ).toBeVisible()
  await expect(page.locator('.app-startup')).toHaveCount(0)
  await page.evaluate(() => document.fonts.ready)
  await expect(page).toHaveScreenshot('login-dark-zh.png', { fullPage: true })
})

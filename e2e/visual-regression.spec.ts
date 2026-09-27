import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: '{"code":"UNAUTHORIZED"}',
    }),
  )
  await page.addInitScript(() => {
    localStorage.setItem('batch-console:locale', 'zh-CN')
    localStorage.setItem('batch-console:theme', 'dark')
  })
})

test('登录入口视觉基线', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await expect(page).toHaveScreenshot('login-dark-zh.png', { fullPage: true })
})
